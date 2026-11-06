"use client";

import type { Address } from "viem";
import { useBalance, useGasPrice } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { useSnapshotReads, type SnapshotReads } from "@/lib/gauge/snapshot-reads";
import { LP_ROUTE_GAUGE_START, lpRouteContracts, parseLpRouteSnapshot, type LpRouteData, type LpRouteResults } from "./snapshot";

/** New quote every 15 s; a quote older than 60 s is blocked (gate). */
export const QUOTE_REFRESH_MS = 15_000;

/**
 * The LP route's reads on the selected network: one multicall snapshot, plus gas balance and price.
 * A failed gauge read only sets `gaugeReadFailed`, so staking is off for that snapshot. `refresh` refetches all three and resolves with the fresh data (the send step re-quotes from it).
 */
export function useLpRouteSnapshot(
  account: Address,
  executor: Address,
): { data: LpRouteData | undefined; error: Error | null; refresh: () => Promise<LpRouteData> } {
  const { network } = useNetwork();
  const reads = useSnapshotReads({
    network,
    contracts: lpRouteContracts(network, executor, account),
    gaugeStart: LP_ROUTE_GAUGE_START,
    refetchInterval: QUOTE_REFRESH_MS,
  });
  const gas = useBalance({ address: account, chainId: network.chainId, query: { refetchInterval: QUOTE_REFRESH_MS } });
  const gasPrice = useGasPrice({ chainId: network.chainId, query: { refetchInterval: QUOTE_REFRESH_MS } });

  const toData = (read: SnapshotReads, gasBalance: bigint, price: bigint | undefined, fetchedAt: number): LpRouteData => ({
    snapshot: parseLpRouteSnapshot(network, read.results as unknown as LpRouteResults, read.gaugeReadFailed),
    gasBalance,
    gasPrice: price,
    fetchedAt,
  });

  return {
    data: reads.data && gas.data ? toData(reads.data, gas.data.value, gasPrice.data, reads.dataUpdatedAt) : undefined,
    error: reads.error ?? gas.error ?? null,
    refresh: async () => {
      const [freshReads, freshGas, freshPrice] = await Promise.all([reads.refetch(), gas.refetch(), gasPrice.refetch()]);
      if (freshReads.error) throw freshReads.error;
      if (freshGas.error) throw freshGas.error;
      if (!freshReads.data || !freshGas.data) throw new Error("LP route snapshot unavailable");
      return toData(freshReads.data, freshGas.data.value, freshPrice.data, freshReads.dataUpdatedAt);
    },
  };
}
