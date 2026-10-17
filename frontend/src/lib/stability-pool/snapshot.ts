import { erc20Abi, type Address } from "viem";
import { multicall3BlockAbi } from "@/lib/abi/multicall3";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import type { NetworkConfig } from "@/lib/config/networks";
import { parseSnapshot, snapshotContracts, type DashboardSnapshot, type SnapshotResults } from "@/lib/dashboard/snapshot";
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
};

export type SpData = { snapshot: SpSnapshot; gasBalance: bigint; gasPrice: bigint | undefined; fetchedAt: number };

type SpTail = readonly [initialDeposit: bigint, allowance: bigint, blockNumber: bigint];
export type SpResults = readonly [...SnapshotResults, ...SpTail];

/** The dashboard's reads plus the Stability Pool's, one multicall at one block, all on the selected network. */
export function spContracts(network: NetworkConfig, account: Address) {
  const { addresses: a, chainId } = network;
  return [
    ...snapshotContracts(network, account),
    { chainId, address: a.stabilityPool, abi: stabilityPoolAbi, functionName: "deposits", args: [account] },
    { chainId, address: a.musd, abi: erc20Abi, functionName: "allowance", args: [account, a.stabilityPool] },
    { chainId, address: a.multicall3, abi: multicall3BlockAbi, functionName: "getBlockNumber" },
  ] as const;
}

export function parseSpSnapshot(network: NetworkConfig, results: SpResults): SpSnapshot {
  const dashboard = parseSnapshot(network, results.slice(0, DASHBOARD_READS) as unknown as SnapshotResults);
  const [initialDeposit, allowance, blockNumber] = results.slice(DASHBOARD_READS) as unknown as SpTail;
  return { dashboard, initialDeposit, allowance, blockNumber };
}
