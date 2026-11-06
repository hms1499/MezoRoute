import { erc20Abi, type Address } from "viem";
import { borrowerOperationsAbi, priceFeedAbi, stabilityPoolAbi, troveManagerAbi, troveSystemAbi } from "@/lib/abi/musd";
import { multicall3BlockAbi } from "@/lib/abi/multicall3";
import { poolAbi, poolFactoryAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";
import { gaugeContracts, GAUGE_READS, parseGaugeState, type GaugeResults, type GaugeState } from "@/lib/gauge/state";

export type Trove = {
  collateral: bigint; // BTC, 1e18, including pending redistribution
  principal: bigint; // MUSD, including pending
  interest: bigint; // MUSD accrued to now, including pending
  debt: bigint; // principal + interest
  maxBorrowingCapacity: bigint; // MUSD; BorrowerOperations rejects borrows past it
};
export type LpPosition = {
  balance: bigint; // the account's LP: wallet + gauge, once `withStakedLp` has run (`parseSnapshot` alone reads the wallet)
  totalSupply: bigint;
  reserveMusd: bigint;
  reserveBtc: bigint;
};
export type SpPosition = { deposit: bigint; btcGain: bigint };
export type Protocol = { mcr: bigint; borrowingRate: bigint };
export type DashboardSnapshot = {
  price: bigint; // MUSD per BTC, 1e18
  protocol: Protocol;
  trove: Trove | null; // null unless the Trove is active
  musd: bigint;
  lp: LpPosition;
  sp: SpPosition;
  poolFeeBps: bigint; // the pool's swap fee in bps (PoolFactory.getFee)
  // Read by the dashboard only (`dashboardContracts`); null in the route pages' own snapshots.
  gauge: GaugeState | null; // null on a network without a gauge
  gaugeReadFailed: boolean; // the gauge's reads failed in this snapshot: `lp.balance` leaves out staked LP
  block: { number: bigint; timestamp: bigint } | null; // the block the snapshot was read at
  troveDebt: bigint | null; // MUSD owed by every open Trove: what liquidations can pay the Stability Pool
  protocolOwnedSp: bigint | null; // MUSD the protocol (PCV) holds in the Stability Pool
};

/** The values of the multicall, in `snapshotContracts` order. */
export type SnapshotResults = readonly [
  price: bigint,
  mcr: bigint,
  borrowingRate: bigint,
  troveStatus: number,
  debtAndColl: readonly [bigint, bigint, bigint, bigint, bigint, bigint],
  maxBorrowingCapacity: bigint,
  musd: bigint,
  lpBalance: bigint,
  lpTotalSupply: bigint,
  reserves: readonly [bigint, bigint, bigint],
  spDeposit: bigint,
  spBtcGain: bigint,
  poolFeeBps: bigint,
];

/** How many reads `snapshotContracts` makes. */
const BASE_READS = 13;

/** Where `dashboardContracts`' gauge reads start. */
export const DASHBOARD_GAUGE_START = BASE_READS;

/** TroveManager `Status.active`; none, closedByOwner, closedByLiquidation, and closedByRedemption mean no open Trove. */
const TROVE_ACTIVE = 1;

/**
 * Every dashboard read, sent as one multicall so all values come from the same block. Each call
 * carries the selected network's chain, so a wallet on another chain still reads this network.
 */
export function snapshotContracts(network: NetworkConfig, account: Address) {
  const { addresses: a, chainId } = network;
  return [
    { chainId, address: a.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" },
    { chainId, address: a.troveManager, abi: troveManagerAbi, functionName: "MCR" },
    { chainId, address: a.borrowerOperations, abi: borrowerOperationsAbi, functionName: "borrowingRate" },
    { chainId, address: a.troveManager, abi: troveManagerAbi, functionName: "getTroveStatus", args: [account] },
    { chainId, address: a.troveManager, abi: troveManagerAbi, functionName: "getEntireDebtAndColl", args: [account] },
    { chainId, address: a.troveManager, abi: troveManagerAbi, functionName: "getTroveMaxBorrowingCapacity", args: [account] },
    { chainId, address: a.musd, abi: erc20Abi, functionName: "balanceOf", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "balanceOf", args: [account] },
    { chainId, address: a.pool, abi: poolAbi, functionName: "totalSupply" },
    { chainId, address: a.pool, abi: poolAbi, functionName: "getReserves" },
    { chainId, address: a.stabilityPool, abi: stabilityPoolAbi, functionName: "getCompoundedMUSDDeposit", args: [account] },
    { chainId, address: a.stabilityPool, abi: stabilityPoolAbi, functionName: "getDepositorCollateralGain", args: [account] },
    { chainId, address: a.poolFactory, abi: poolFactoryAbi, functionName: "getFee", args: [a.pool, false] },
  ] as const;
}

/** Tigris sorts a pair by address: testnet's token0 is MUSD, mainnet's is BTC. */
export function musdIsToken0(network: NetworkConfig): boolean {
  return BigInt(network.addresses.musd) < BigInt(network.addresses.btc);
}

export function parseSnapshot(network: NetworkConfig, results: SnapshotResults): DashboardSnapshot {
  const [price, mcr, borrowingRate, status, debtAndColl, maxBorrowingCapacity, musd, lpBalance, lpTotalSupply, reserves, spDeposit, spBtcGain, poolFeeBps] =
    results;
  const [collateral, principal, interest] = debtAndColl;
  const musdFirst = musdIsToken0(network);
  return {
    price,
    protocol: { mcr, borrowingRate },
    trove:
      status === TROVE_ACTIVE
        ? { collateral, principal, interest, debt: principal + interest, maxBorrowingCapacity }
        : null,
    musd,
    lp: {
      balance: lpBalance,
      totalSupply: lpTotalSupply,
      reserveMusd: musdFirst ? reserves[0] : reserves[1],
      reserveBtc: musdFirst ? reserves[1] : reserves[0],
    },
    sp: { deposit: spDeposit, btcGain: spBtcGain },
    poolFeeBps,
    gauge: null,
    gaugeReadFailed: false,
    block: null,
    troveDebt: null,
    protocolOwnedSp: null,
  };
}

/** Adds LP staked in the gauge to `lp.balance`: staked LP moves with BTC exactly like LP in the wallet. */
export function withStakedLp(snapshot: DashboardSnapshot, gauge: GaugeState | null): DashboardSnapshot {
  if (!gauge) return snapshot;
  return { ...snapshot, lp: { ...snapshot.lp, balance: snapshot.lp.balance + gauge.staked } };
}

/** The dashboard's extra reads after the base ones and the gauge's: block, open Trove debt, protocol-owned Stability Pool. */
const DASHBOARD_TAIL = 4;

type DashboardTail = readonly [blockNumber: bigint, blockTimestamp: bigint, troveDebt: bigint, protocolOwnedSp: bigint];

/** `snapshotContracts` plus the gauge, the block, the open Trove debt, and the PCV's Stability Pool deposit (Compare, G1). */
export function dashboardContracts(network: NetworkConfig, account: Address) {
  const { addresses: a, chainId } = network;
  return [
    ...snapshotContracts(network, account),
    ...gaugeContracts(network, account),
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getBlockNumber" },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getCurrentBlockTimestamp" },
    { chainId, address: a.troveManager, abi: troveSystemAbi, functionName: "getEntireSystemDebt" },
    { chainId, address: a.stabilityPool, abi: stabilityPoolAbi, functionName: "getCompoundedMUSDDeposit", args: [a.pcv] },
  ] as const;
}

export function parseDashboard(network: NetworkConfig, results: readonly unknown[], gaugeReadFailed = false): DashboardSnapshot {
  const base = parseSnapshot(network, results.slice(0, BASE_READS) as unknown as SnapshotResults);
  const gaugeResults = results.slice(BASE_READS, results.length - DASHBOARD_TAIL);
  const [blockNumber, blockTimestamp, troveDebt, protocolOwnedSp] = results.slice(results.length - DASHBOARD_TAIL) as unknown as DashboardTail;
  const gauge = network.gauge && gaugeResults.length === GAUGE_READS ? parseGaugeState(gaugeResults as unknown as GaugeResults) : null;
  return {
    ...withStakedLp(base, gauge),
    gauge,
    gaugeReadFailed,
    block: { number: blockNumber, timestamp: blockTimestamp },
    troveDebt,
    protocolOwnedSp,
  };
}
