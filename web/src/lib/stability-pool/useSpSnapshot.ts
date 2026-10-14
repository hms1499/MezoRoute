"use client";

import type { Address } from "viem";
import { useBalance, useGasPrice, useReadContracts } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { QUOTE_REFRESH_MS } from "@/lib/routes/musd-btc-lp/useLpRouteSnapshot";
import { parseSpSnapshot, spContracts, type SpData, type SpResults } from "./snapshot";

/**
 * The Stability Pool reads on the selected network: one multicall snapshot plus gas balance and
 * price, refetched every 15 s. `refresh` resolves with fresh data (every send re-gates on it).
 */
export function useSpSnapshot(account: Address): { data: SpData | undefined; error: Error | null; refresh: () => Promise<SpData> } {
  const { network } = useNetwork();
  const reads = useReadContracts({
    contracts: spContracts(network, account),
    allowFailure: false,
    query: { refetchInterval: QUOTE_REFRESH_MS },
  });
  const gas = useBalance({ address: account, chainId: network.chainId, query: { refetchInterval: QUOTE_REFRESH_MS } });
  const gasPrice = useGasPrice({ chainId: network.chainId, query: { refetchInterval: QUOTE_REFRESH_MS } });

  const toData = (results: unknown, gasBalance: bigint, price: bigint | undefined, fetchedAt: number): SpData => ({
    snapshot: parseSpSnapshot(network, results as SpResults),
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
      if (!freshReads.data || !freshGas.data) throw new Error("Stability Pool snapshot unavailable");
      return toData(freshReads.data, freshGas.data.value, freshPrice.data, freshReads.dataUpdatedAt);
    },
  };
}
