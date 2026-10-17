"use client";

import type { Address } from "viem";
import { useBalance, useGasPrice, useReadContracts } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { lpRouteContracts, parseLpRouteSnapshot, type LpRouteData, type LpRouteResults } from "./snapshot";

/** New quote every 15 s; a quote older than 60 s is blocked (gate). */
export const QUOTE_REFRESH_MS = 15_000;

/**
 * The LP route's reads on the selected network: one multicall snapshot, plus gas balance and price.
 * `refresh` refetches all three and resolves with the fresh data (the send step re-quotes from it).
 */
export function useLpRouteSnapshot(
  account: Address,
  executor: Address,
): { data: LpRouteData | undefined; error: Error | null; refresh: () => Promise<LpRouteData> } {
  const { network } = useNetwork();
  const reads = useReadContracts({
    contracts: lpRouteContracts(network, executor, account),
    allowFailure: false,
    query: { refetchInterval: QUOTE_REFRESH_MS },
  });
  const gas = useBalance({ address: account, chainId: network.chainId, query: { refetchInterval: QUOTE_REFRESH_MS } });
  const gasPrice = useGasPrice({ chainId: network.chainId, query: { refetchInterval: QUOTE_REFRESH_MS } });

  const toData = (results: unknown, gasBalance: bigint, price: bigint | undefined, fetchedAt: number): LpRouteData => ({
    snapshot: parseLpRouteSnapshot(network, results as LpRouteResults),
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
