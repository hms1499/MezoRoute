"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { historyKey, loadHistory, parseHistory, serializeHistory, type HistoryCache, type HistoryEvent } from "./history";
import { readExecutorEvents, type LogsClient } from "./history-reader";

const HISTORY_REFRESH_MS = 60_000;

function readStored(key: string): HistoryCache | null {
  try {
    return parseHistory(window.localStorage.getItem(key));
  } catch {
    return null; // storage blocked: scan from the deployment block
  }
}

function writeStored(key: string, cache: HistoryCache): void {
  try {
    window.localStorage.setItem(key, serializeHistory(cache));
  } catch {
    // A full or blocked storage only costs a longer scan next time.
  }
}

/**
 * The account's executor events for the cost basis (spec §12 "Positions data"). The cache is a
 * convenience: a failed scan reports an error and writes nothing. Without an executor there is no history.
 */
export function usePositionsHistory(account: Address): {
  events: HistoryEvent[] | undefined;
  error: Error | null;
  retry: () => void;
} {
  const { network } = useNetwork();
  const client = usePublicClient({ chainId: network.chainId });
  const executor = network.executor;
  const query = useQuery({
    queryKey: ["positions-history", network.chainId, executor?.address, account],
    enabled: client !== undefined && executor !== null,
    refetchInterval: HISTORY_REFRESH_MS,
    retry: false,
    queryFn: async () => {
      if (!client || !executor) return [];
      const key = historyKey(network, executor.address, account);
      const { events, cache } = await loadHistory({
        read: (range) => readExecutorEvents(client as unknown as LogsClient, executor.address, account, range),
        head: await client.getBlockNumber({ cacheTime: 0 }),
        deployBlock: executor.deployBlock,
        cache: readStored(key),
      });
      if (cache) writeStored(key, cache);
      return events;
    },
  });
  if (!executor) return { events: [], error: null, retry: () => undefined };
  return { events: query.data, error: query.error, retry: () => void query.refetch() };
}
