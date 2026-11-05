import { erc20Abi, type Address } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { multicall3BlockAbi } from "@/lib/abi/multicall3";
import { borrowerOperationsSignaturesAbi, musdPermitAbi, troveSystemAbi } from "@/lib/abi/musd";
import { gaugeContracts, GAUGE_READS, parseGaugeState, type GaugeResults, type GaugeState } from "@/lib/gauge/state";
import type { NetworkConfig } from "@/lib/config/networks";
import { parseSnapshot, snapshotContracts, type DashboardSnapshot, type SnapshotResults } from "@/lib/dashboard/snapshot";
import type { PoolState } from "@/lib/quote/entry";
import type { SystemState } from "@/lib/trove/borrow";

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
  borrowNonce: bigint; // BorrowerOperationsSignatures nonce of the account
  system: SystemState; // recovery mode and hint trials
  gauge: GaugeState | null; // null on a network without a gauge
};

/** The snapshot plus gas, as the hook returns it; `fetchedAt` (ms) dates the quote. */
export type LpRouteData = { snapshot: LpRouteSnapshot; gasBalance: bigint; gasPrice: bigint | undefined; fetchedAt: number };

/** How many reads `snapshotContracts` makes; the LP-route reads follow them. */
export const DASHBOARD_READS = 13;

/** The LP route's own reads between the dashboard's and the gauge's. */
const LP_ROUTE_READS = 11;

type LpRouteTail = readonly [
  allowance: bigint,
  permitNonce: bigint,
  executorFeeBps: bigint,
  maxMusdIn: bigint,
  blockNumber: bigint,
  blockTimestamp: bigint,
  borrowNonce: bigint,
  systemColl: bigint,
  systemDebt: bigint,
  ccr: bigint,
  troveCount: bigint,
];
export type LpRouteResults = readonly [...SnapshotResults, ...LpRouteTail, ...(readonly unknown[])];

/** The dashboard's reads plus the LP route's, one multicall at one block, all on the selected network. */
export function lpRouteContracts(network: NetworkConfig, executor: Address, account: Address) {
  const { addresses: a, chainId } = network;
  return [
    ...snapshotContracts(network, account),
    { chainId, address: a.musd, abi: erc20Abi, functionName: "allowance", args: [account, executor] },
    { chainId, address: a.musd, abi: musdPermitAbi, functionName: "nonces", args: [account] },
    { chainId, address: executor, abi: mezoRouteExecutorAbi, functionName: "feeBps" },
    { chainId, address: executor, abi: mezoRouteExecutorAbi, functionName: "maxMusdIn" },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getBlockNumber" },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getCurrentBlockTimestamp" },
    { chainId, address: a.borrowerOperationsSignatures, abi: borrowerOperationsSignaturesAbi, functionName: "getNonce", args: [account] },
    { chainId, address: a.troveManager, abi: troveSystemAbi, functionName: "getEntireSystemColl" },
    { chainId, address: a.troveManager, abi: troveSystemAbi, functionName: "getEntireSystemDebt" },
    { chainId, address: a.troveManager, abi: troveSystemAbi, functionName: "CCR" },
    { chainId, address: a.troveManager, abi: troveSystemAbi, functionName: "getTroveOwnersCount" },
    ...gaugeContracts(network, account),
  ] as const;
}

export function parseLpRouteSnapshot(network: NetworkConfig, results: LpRouteResults): LpRouteSnapshot {
  const dashboard = parseSnapshot(network, results.slice(0, DASHBOARD_READS) as unknown as SnapshotResults);
  const [
    allowance,
    permitNonce,
    executorFeeBps,
    maxMusdIn,
    blockNumber,
    blockTimestamp,
    borrowNonce,
    systemColl,
    systemDebt,
    ccr,
    troveCount,
  ] = results.slice(DASHBOARD_READS) as unknown as LpRouteTail;
  const gaugeResults = results.slice(DASHBOARD_READS + LP_ROUTE_READS);
  return {
    dashboard,
    pool: {
      reserveMusd: dashboard.lp.reserveMusd,
      reserveBtc: dashboard.lp.reserveBtc,
      totalSupply: dashboard.lp.totalSupply,
      feeBps: dashboard.poolFeeBps,
    },
    allowance,
    permitNonce,
    executorFeeBps,
    maxMusdIn,
    blockNumber,
    blockTimestamp,
    borrowNonce,
    system: { coll: systemColl, debt: systemDebt, ccr, troveCount },
    gauge: network.gauge && gaugeResults.length === GAUGE_READS ? parseGaugeState(gaugeResults as unknown as GaugeResults) : null,
  };
}
