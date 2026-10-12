import { erc20Abi, type Address } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { multicall3BlockAbi } from "@/lib/abi/multicall3";
import { musdPermitAbi } from "@/lib/abi/musd";
import { poolFactoryAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";
import { parseSnapshot, snapshotContracts, type DashboardSnapshot, type SnapshotResults } from "@/lib/dashboard/snapshot";
import type { PoolState } from "@/lib/quote/entry";

/** Everything the LP route reads, from one block. */
export type LpRouteSnapshot = {
  dashboard: DashboardSnapshot;
  pool: PoolState;
  allowance: bigint; // MUSD the executor may already pull from the account
  permitNonce: bigint; // MUSD EIP-2612 nonce of the account
  executorFeeBps: bigint; // read on chain; the gate compares it with the pinned fee
  maxMusdIn: bigint; // the executor's per-transaction entry cap
  blockNumber: bigint;
  blockTimestamp: bigint;
};

/** The snapshot plus gas, as the hook returns it; `fetchedAt` (ms) dates the quote. */
export type LpRouteData = { snapshot: LpRouteSnapshot; gasBalance: bigint; gasPrice: bigint | undefined; fetchedAt: number };

/** How many reads `snapshotContracts` makes; the LP-route reads follow them. */
export const DASHBOARD_READS = 12;

type LpRouteTail = readonly [
  poolFeeBps: bigint,
  allowance: bigint,
  permitNonce: bigint,
  executorFeeBps: bigint,
  maxMusdIn: bigint,
  blockNumber: bigint,
  blockTimestamp: bigint,
];
export type LpRouteResults = readonly [...SnapshotResults, ...LpRouteTail];

/** The dashboard's reads plus the LP route's, one multicall at one block, all on the selected network. */
export function lpRouteContracts(network: NetworkConfig, executor: Address, account: Address) {
  const { addresses: a, chainId } = network;
  return [
    ...snapshotContracts(network, account),
    { chainId, address: a.poolFactory, abi: poolFactoryAbi, functionName: "getFee", args: [a.pool, false] },
    { chainId, address: a.musd, abi: erc20Abi, functionName: "allowance", args: [account, executor] },
    { chainId, address: a.musd, abi: musdPermitAbi, functionName: "nonces", args: [account] },
    { chainId, address: executor, abi: mezoRouteExecutorAbi, functionName: "feeBps" },
    { chainId, address: executor, abi: mezoRouteExecutorAbi, functionName: "maxMusdIn" },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getBlockNumber" },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getCurrentBlockTimestamp" },
  ] as const;
}

export function parseLpRouteSnapshot(network: NetworkConfig, results: LpRouteResults): LpRouteSnapshot {
  const dashboard = parseSnapshot(network, results.slice(0, DASHBOARD_READS) as unknown as SnapshotResults);
  const [poolFeeBps, allowance, permitNonce, executorFeeBps, maxMusdIn, blockNumber, blockTimestamp] = results.slice(
    DASHBOARD_READS,
  ) as unknown as LpRouteTail;
  return {
    dashboard,
    pool: {
      reserveMusd: dashboard.lp.reserveMusd,
      reserveBtc: dashboard.lp.reserveBtc,
      totalSupply: dashboard.lp.totalSupply,
      feeBps: poolFeeBps,
    },
    allowance,
    permitNonce,
    executorFeeBps,
    maxMusdIn,
    blockNumber,
    blockTimestamp,
  };
}
