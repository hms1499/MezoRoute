import { erc20Abi, type Address } from "viem";
import { multicall3BlockAbi } from "@/lib/abi/multicall3";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import type { NetworkConfig } from "@/lib/config/networks";
import { parseSnapshot, snapshotContracts, withStakedLp, type DashboardSnapshot, type SnapshotResults } from "@/lib/dashboard/snapshot";
import { gaugeContracts, GAUGE_READS, parseGaugeState, type GaugeResults, type GaugeState } from "@/lib/gauge/state";
import { DASHBOARD_READS } from "@/lib/routes/musd-btc-lp/snapshot";

/**
 * Everything the Stability Pool pages read, from one block. The compounded deposit and pending BTC
 * gain are `dashboard.sp`; `initialDeposit` is `deposits(account)` (the deposit at the last action).
 */
export type SpSnapshot = {
  dashboard: DashboardSnapshot;
  initialDeposit: bigint;
  allowance: bigint; // MUSD the Stability Pool may already pull
  blockNumber: bigint;
  // U17: what the planner's comparison needs for the LP side's "This week" (the gauge's week against the block's time).
  blockTimestamp: bigint;
  gauge: GaugeState | null; // null on a network without a gauge, or when its reads failed
};

export type SpData = { snapshot: SpSnapshot; gasBalance: bigint; gasPrice: bigint | undefined; fetchedAt: number };

type SpTail = readonly [initialDeposit: bigint, allowance: bigint, blockNumber: bigint, blockTimestamp: bigint];
export type SpResults = readonly [...SnapshotResults, ...SpTail, ...(readonly unknown[])];

/** The Stability Pool's own reads between the dashboard's and the gauge's. */
const SP_READS = 4;

/** Where `spContracts`' gauge reads start. */
export const SP_GAUGE_START = DASHBOARD_READS + SP_READS;

/** The dashboard's reads, the Stability Pool's, then the gauge's (staked LP counts in BTC exposure), one multicall at one block, all on the selected network. */
export function spContracts(network: NetworkConfig, account: Address) {
  const { addresses: a, chainId } = network;
  return [
    ...snapshotContracts(network, account),
    { chainId, address: a.stabilityPool, abi: stabilityPoolAbi, functionName: "deposits", args: [account] },
    { chainId, address: a.musd, abi: erc20Abi, functionName: "allowance", args: [account, a.stabilityPool] },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getBlockNumber" },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getCurrentBlockTimestamp" },
    ...gaugeContracts(network, account),
  ] as const;
}

export function parseSpSnapshot(network: NetworkConfig, results: SpResults, gaugeReadFailed = false): SpSnapshot {
  const [initialDeposit, allowance, blockNumber, blockTimestamp] = results.slice(DASHBOARD_READS, SP_GAUGE_START) as unknown as SpTail;
  const gaugeResults = results.slice(SP_GAUGE_START);
  const gauge = network.gauge && gaugeResults.length === GAUGE_READS ? parseGaugeState(gaugeResults as unknown as GaugeResults) : null;
  const dashboard = { ...withStakedLp(parseSnapshot(network, results.slice(0, DASHBOARD_READS) as unknown as SnapshotResults), gauge), gaugeReadFailed };
  return { dashboard, initialDeposit, allowance, blockNumber, blockTimestamp, gauge };
}
