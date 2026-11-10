"use client";

import { zeroAddress, type Address } from "viem";
import { useBalance, useGasPrice } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { useSnapshotReads, type SnapshotReads } from "@/lib/gauge/snapshot-reads";
import {
  LP_ROUTE_BTC_ALLOWANCE_INDEX,
  LP_ROUTE_GAUGE_START,
  lpRouteContracts,
  parseLpRouteSnapshot,
  type LpRouteData,
  type LpRouteResults,
} from "./snapshot";

/** New quote every 15 s; a quote older than 60 s is blocked (gate). */
export const QUOTE_REFRESH_MS = 15_000;

/**
 * The LP route's reads on the selected network: one multicall snapshot, plus gas balance and price.
 * A failed gauge read only sets `gaugeReadFailed`, so staking is off for that snapshot. `refresh` refetches all three and resolves with the fresh data (the send step re-quotes from it).
 *
 * U13: with no account (the read-only planner) every account-scoped call is made with the zero address, which the
 * chain answers with a non-existent Trove and zero balances (verified on testnet, spec §Zero-address reads), so the
 * page can quote without a wallet. The gas-balance query is disabled and the snapshot reports `0n`, which no figure
 * shows: the planner renders no balance at all.
 */
export function useLpRouteSnapshot(
  account: Address | undefined,
  executor: Address,
): { data: LpRouteData | undefined; error: Error | null; refresh: () => Promise<LpRouteData> } {
  const { network } = useNetwork();
  const connected = account !== undefined;
  const reads = useSnapshotReads({
    network,
    contracts: lpRouteContracts(network, executor, account ?? zeroAddress),
    gaugeStart: LP_ROUTE_GAUGE_START,
    // The BTC precompile reverts `allowance(0x0, …)`: with no wallet there is no allowance, and 0n says exactly that.
    tolerate: connected ? undefined : new Map([[LP_ROUTE_BTC_ALLOWANCE_INDEX, 0n]]),
    refetchInterval: QUOTE_REFRESH_MS,
  });
  const gas = useBalance({
    address: account,
    chainId: network.chainId,
    query: { enabled: connected, refetchInterval: QUOTE_REFRESH_MS },
  });
  const gasPrice = useGasPrice({ chainId: network.chainId, query: { refetchInterval: QUOTE_REFRESH_MS } });

  const toData = (read: SnapshotReads, gasBalance: bigint, price: bigint | undefined, fetchedAt: number): LpRouteData => ({
    snapshot: parseLpRouteSnapshot(network, read.results as unknown as LpRouteResults, read.gaugeReadFailed),
    gasBalance,
    gasPrice: price,
    fetchedAt,
  });

  return {
    data: reads.data && (gas.data || !connected) ? toData(reads.data, gas.data?.value ?? 0n, gasPrice.data, reads.dataUpdatedAt) : undefined,
    error: reads.error ?? (connected ? gas.error : null) ?? null,
    refresh: async () => {
      const [freshReads, freshGas, freshPrice] = await Promise.all([reads.refetch(), gas.refetch(), gasPrice.refetch()]);
      if (freshReads.error) throw freshReads.error;
      if (connected && freshGas.error) throw freshGas.error;
      if (!freshReads.data) throw new Error("LP route snapshot unavailable");
      if (connected && !freshGas.data) throw new Error("LP route snapshot unavailable");
      return toData(freshReads.data, freshGas.data?.value ?? 0n, freshPrice.data, freshReads.dataUpdatedAt);
    },
  };
}
