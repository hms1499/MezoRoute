import { erc20Abi, type Address } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { multicall3BlockAbi } from "@/lib/abi/multicall3";
import { borrowerOperationsSignaturesAbi, musdPermitAbi, troveSystemAbi } from "@/lib/abi/musd";
import { gaugeContracts, GAUGE_READS, parseGaugeState, type GaugeResults, type GaugeState } from "@/lib/gauge/state";
import type { NetworkConfig } from "@/lib/config/networks";
import { parseSnapshot, snapshotContracts, withStakedLp, type DashboardSnapshot, type SnapshotResults } from "@/lib/dashboard/snapshot";
import type { PoolState } from "@/lib/quote/entry";
import type { SystemState } from "@/lib/trove/borrow";

/** Everything the LP route reads, from one block. */
export type LpRouteSnapshot = {
  dashboard: DashboardSnapshot;
  pool: PoolState;
  allowance: bigint; // MUSD the executor may already pull from the account
  permitNonce: bigint; // MUSD EIP-2612 nonce of the account
  btcAllowance: bigint; // BTC the executor may already pull from the account (BTC entries)
  btcPermitNonce: bigint; // BTC EIP-2612 nonce of the account
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
const LP_ROUTE_READS = 13;

/** Where `lpRouteContracts`' gauge reads start. */
export const LP_ROUTE_GAUGE_START = DASHBOARD_READS + LP_ROUTE_READS;

/**
 * The BTC allowance in the LP route's tail (the twelfth read). The BTC token is a chain precompile, and
 * `allowance(0x0, executor)` reverts there (measured 10 Nov 2026 through this very multicall on rpc.test.mezo.org),
 * so the planner tolerates that one read as `0n`: a wallet that is not connected has no allowance.
 */
export const LP_ROUTE_BTC_ALLOWANCE_INDEX = DASHBOARD_READS + 11;

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
  btcAllowance: bigint,
  btcPermitNonce: bigint,
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
    { chainId, address: a.btc, abi: erc20Abi, functionName: "allowance", args: [account, executor] },
    { chainId, address: a.btc, abi: musdPermitAbi, functionName: "nonces", args: [account] },
    ...gaugeContracts(network, account),
  ] as const;
}

export function parseLpRouteSnapshot(network: NetworkConfig, results: LpRouteResults, gaugeReadFailed = false): LpRouteSnapshot {
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
    btcAllowance,
    btcPermitNonce,
  ] = results.slice(DASHBOARD_READS) as unknown as LpRouteTail;
  const gaugeResults = results.slice(LP_ROUTE_GAUGE_START);
  const gauge = network.gauge && gaugeResults.length === GAUGE_READS ? parseGaugeState(gaugeResults as unknown as GaugeResults) : null;
  const dashboard = { ...withStakedLp(parseSnapshot(network, results.slice(0, DASHBOARD_READS) as unknown as SnapshotResults), gauge), gaugeReadFailed };
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
    btcAllowance,
    btcPermitNonce,
    executorFeeBps,
    maxMusdIn,
    blockNumber,
    blockTimestamp,
    borrowNonce,
    system: { coll: systemColl, debt: systemDebt, ccr, troveCount },
    gauge,
  };
}
