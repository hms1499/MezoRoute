"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useConfig, useReadContracts } from "wagmi";
import { readContracts } from "wagmi/actions";
import { useNetwork } from "@/lib/config/network-context";
import { QUOTE_REFRESH_MS } from "@/lib/routes/musd-btc-lp/useLpRouteSnapshot";
import { readQueue, type QueueEntry } from "./queue";
import { parseTroveSnapshot, troveSnapshotContracts, type TroveSnapshot, type TroveSnapshotResults } from "./snapshot";

export type TroveData = { snapshot: TroveSnapshot; fetchedAt: number };

/**
 * The Trove pages' reads on the selected network: one multicall snapshot every 15 s, and the redemption
 * queue beside it (every Trove, paged). A failed queue read gives `queue: null` and blanks only the
 * queue line; `refresh` refetches the snapshot and resolves with it (the send step re-quotes from it).
 */
export function useTroveSnapshot(account: Address): {
  data: TroveData | undefined;
  error: Error | null;
  queue: QueueEntry[] | null;
  refresh: () => Promise<TroveData>;
} {
  const { network } = useNetwork();
  const config = useConfig();
  const reads = useReadContracts({
    contracts: troveSnapshotContracts(network, account),
    allowFailure: false,
    query: { refetchInterval: QUOTE_REFRESH_MS },
  });
  const price = reads.data ? (reads.data[0] as bigint) : undefined;
  const queue = useQuery({
    queryKey: ["trove-queue", network.id, price?.toString()],
    enabled: price !== undefined,
    staleTime: 60_000,
    retry: 1,
    queryFn: () =>
      readQueue(
        (contracts) => readContracts(config, { contracts: contracts as never, allowFailure: false }) as Promise<readonly unknown[]>,
        network,
        price as bigint,
      ),
  });

  const toData = (results: readonly unknown[], fetchedAt: number): TroveData => ({
    snapshot: parseTroveSnapshot(network, results as unknown as TroveSnapshotResults),
    fetchedAt,
  });

  return {
    data: reads.data ? toData(reads.data, reads.dataUpdatedAt) : undefined,
    error: reads.error ?? null,
    queue: queue.data ?? null,
    refresh: async () => {
      const fresh = await reads.refetch({ throwOnError: true });
      if (!fresh.data) throw new Error("Trove snapshot: no data");
      return toData(fresh.data, fresh.dataUpdatedAt);
    },
  };
}
