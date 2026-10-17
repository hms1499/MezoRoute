import type { Address } from "viem";
import { priceFeedAbi, stabilityPoolAbi } from "@/lib/abi/musd";
import { poolAbi, poolFactoryAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";
import { musdIsToken0 } from "@/lib/dashboard/snapshot";
import { lpBacktest, type LpBacktest, type PoolPoint } from "./lp-backtest";
import { spBacktest, type SpBacktest, type SpNow, type SpPast } from "./sp-backtest";
import { pastBlock, REF_SPAN } from "./window";

export const HISTORY_TIMEOUT_MS = 15_000;

/** Both routes' state at the block ≈30 days back and at the head (spec F6 §2). */
export type RouteHistory = {
  pastBlock: bigint;
  pastTime: bigint;
  headBlock: bigint;
  headTime: bigint;
  price: bigint; // oracle price at the head (values the Stability Pool's BTC gain)
  pool: { past: PoolPoint; now: PoolPoint };
  sp: { past: SpPast; now: SpNow };
};

/** The two public-client calls the history needs; wagmi's public client satisfies it. */
export type HistoryClient = {
  getBlock(args?: { blockNumber: bigint }): Promise<{ number: bigint | null; timestamp: bigint }>;
  multicall(args: {
    contracts: readonly unknown[];
    blockNumber?: bigint; // omitted: the latest block
    allowFailure: false;
    multicallAddress: Address;
  }): Promise<readonly unknown[]>;
};

type PoolResults = readonly [index0: bigint, index1: bigint, reserves: readonly [bigint, bigint, bigint], totalSupply: bigint, feeBps: bigint];
const POOL_READS = 5;

function poolReads(network: NetworkConfig) {
  const a = network.addresses;
  return [
    { address: a.pool, abi: poolAbi, functionName: "index0" },
    { address: a.pool, abi: poolAbi, functionName: "index1" },
    { address: a.pool, abi: poolAbi, functionName: "getReserves" },
    { address: a.pool, abi: poolAbi, functionName: "totalSupply" },
    { address: a.poolFactory, abi: poolFactoryAbi, functionName: "getFee", args: [a.pool, false] },
  ] as const;
}

function spStateReads(network: NetworkConfig) {
  const sp = network.addresses.stabilityPool;
  return [
    { address: sp, abi: stabilityPoolAbi, functionName: "P" },
    { address: sp, abi: stabilityPoolAbi, functionName: "currentEpoch" },
    { address: sp, abi: stabilityPoolAbi, functionName: "currentScale" },
  ] as const;
}

function sumRead(network: NetworkConfig, epoch: bigint, scale: bigint) {
  return { address: network.addresses.stabilityPool, abi: stabilityPoolAbi, functionName: "epochToScaleToSum", args: [epoch, scale] } as const;
}

function parsePool(network: NetworkConfig, results: PoolResults): PoolPoint {
  const [index0, index1, reserves, totalSupply, feeBps] = results;
  const musdFirst = musdIsToken0(network);
  return {
    reserveMusd: musdFirst ? reserves[0] : reserves[1],
    reserveBtc: musdFirst ? reserves[1] : reserves[0],
    totalSupply,
    feeBps,
    indexMusd: musdFirst ? index0 : index1,
    indexBtc: musdFirst ? index1 : index0,
  };
}

/**
 * Four round trips: the head block; the block REF_SPAN back (for the average block time); the past
 * block's timestamp with the past state; then the past sum with the head state (both need the past
 * epoch and scale). Needs archive state; any failure rejects, and the card shows only the 30-day
 * rows as unavailable.
 */
export async function fetchRouteHistory(client: HistoryClient, network: NetworkConfig): Promise<RouteHistory> {
  const multicallAddress = network.addresses.multicall3;
  const head = await client.getBlock();
  if (head.number === null) throw new Error("The RPC returned a pending head block");
  const headBlock = head.number;
  const ref = await client.getBlock({ blockNumber: headBlock - REF_SPAN });
  const past = pastBlock(headBlock, head.timestamp, ref.timestamp);
  const [pastHeader, pastState] = await Promise.all([
    client.getBlock({ blockNumber: past }),
    client.multicall({
      contracts: [...poolReads(network), ...spStateReads(network)],
      blockNumber: past,
      allowFailure: false,
      multicallAddress,
    }),
  ]);
  const [pastP, pastEpoch, pastScale] = pastState.slice(POOL_READS) as [bigint, bigint, bigint];
  const [pastSum, headState] = await Promise.all([
    client.multicall({ contracts: [sumRead(network, pastEpoch, pastScale)], blockNumber: past, allowFailure: false, multicallAddress }),
    client.multicall({
      contracts: [
        ...poolReads(network),
        { address: network.addresses.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" },
        ...spStateReads(network),
        sumRead(network, pastEpoch, pastScale),
        sumRead(network, pastEpoch, pastScale + 1n),
      ],
      blockNumber: headBlock,
      allowFailure: false,
      multicallAddress,
    }),
  ]);
  const [price, nowP, nowEpoch, nowScale, sumAtPastScale, sumAtNextScale] = headState.slice(POOL_READS) as [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
  ];
  return {
    pastBlock: past,
    pastTime: pastHeader.timestamp,
    headBlock,
    headTime: head.timestamp,
    price,
    pool: {
      past: parsePool(network, pastState.slice(0, POOL_READS) as unknown as PoolResults),
      now: parsePool(network, headState.slice(0, POOL_READS) as unknown as PoolResults),
    },
    sp: {
      past: { P: pastP, S: pastSum[0] as bigint, epoch: pastEpoch, scale: pastScale },
      now: { P: nowP, epoch: nowEpoch, scale: nowScale, sumAtPastScale, sumAtNextScale },
    },
  };
}

export type RouteBacktests = {
  lp: LpBacktest | null;
  sp: SpBacktest;
  seconds: bigint;
  pastTime: bigint;
  pastBlock: bigint;
  headBlock: bigint;
};

/** Both backtests for one amount over the history's real window. */
export function backtestRoutes(history: RouteHistory, amount: bigint, executorFeeBps: bigint): RouteBacktests {
  const seconds = history.headTime - history.pastTime;
  return {
    lp: lpBacktest({ past: history.pool.past, now: history.pool.now, amount, executorFeeBps, seconds }),
    sp: spBacktest({ past: history.sp.past, now: history.sp.now, price: history.price, amount }),
    seconds,
    pastTime: history.pastTime,
    pastBlock: history.pastBlock,
    headBlock: history.headBlock,
  };
}

/** Rejects if `promise` has not settled after `ms` (the public testnet RPC can hang). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
