"use client";

import { zeroAddress, type Address } from "viem";
import { useBalance, useGasPrice } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { useSnapshotReads, type SnapshotReads } from "@/lib/gauge/snapshot-reads";
import { QUOTE_REFRESH_MS } from "@/lib/routes/musd-btc-lp/useLpRouteSnapshot";
import { parseSpSnapshot, SP_GAUGE_START, spContracts, type SpData, type SpResults } from "./snapshot";

/**
 * The Stability Pool reads on the selected network: one multicall snapshot plus gas balance and
 * price, refetched every 15 s. A failed gauge read only sets `gaugeReadFailed`. `refresh` resolves with fresh data (every send re-gates on it).
 *
 * U17: with no account (the read-only planner) every account-scoped call is made with the zero address, which the
 * chain answers with zeroes (`deposits(0x0)` and `allowance(0x0, pool)` verified on both networks, spec §5), as
 * `useLpRouteSnapshot` does. The gas-balance query is disabled and the snapshot reports `0n`, which no figure shows.
 */
export function useSpSnapshot(account: Address | undefined): { data: SpData | undefined; error: Error | null; refresh: () => Promise<SpData> } {
  const { network } = useNetwork();
  const connected = account !== undefined;
  const reads = useSnapshotReads({
    network,
    contracts: spContracts(network, account ?? zeroAddress),
    gaugeStart: SP_GAUGE_START,
    refetchInterval: QUOTE_REFRESH_MS,
  });
  const gas = useBalance({ address: account, chainId: network.chainId, query: { enabled: connected, refetchInterval: QUOTE_REFRESH_MS } });
  const gasPrice = useGasPrice({ chainId: network.chainId, query: { refetchInterval: QUOTE_REFRESH_MS } });

  const toData = (read: SnapshotReads, gasBalance: bigint, price: bigint | undefined, fetchedAt: number): SpData => ({
    snapshot: parseSpSnapshot(network, read.results as unknown as SpResults, read.gaugeReadFailed),
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
      if (!freshReads.data || (connected && !freshGas.data)) throw new Error("Stability Pool snapshot unavailable");
      return toData(freshReads.data, freshGas.data?.value ?? 0n, freshPrice.data, freshReads.dataUpdatedAt);
    },
  };
}
