"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import {
  historyExecutors,
  historyKey,
  loadAllHistory,
  parseHistory,
  serializeHistory,
  visibleHistory,
  type HistoryCache,
  type HistoryEvent,
} from "./history";
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
 * The account's events from the current and older executors for the cost basis (spec §12 "Positions data"). The
 * cache is a convenience: a failed scan reports an error and writes nothing. Without an executor there is no history.
 */
export function usePositionsHistory(account: Address): {
  events: HistoryEvent[] | undefined;
  error: Error | null;
  retry: () => void;
} {
  const { network } = useNetwork();
  const client = usePublicClient({ chainId: network.chainId });
  const executors = historyExecutors(network);
  const query = useQuery({
    queryKey: ["positions-history", network.chainId, executors.map((item) => item.address).join(), account],
    enabled: client !== undefined && executors.length > 0,
    refetchInterval: HISTORY_REFRESH_MS,
    retry: false,
    queryFn: async () => {
      if (!client) return [];
      return loadAllHistory({
        executors,
        readFor: (executor) => (range) => readExecutorEvents(client as unknown as LogsClient, executor, account, range),
        readCache: (executor) => readStored(historyKey(network, executor, account)),
        writeCache: (executor, cache) => writeStored(historyKey(network, executor, account), cache),
        head: await client.getBlockNumber({ cacheTime: 0 }),
      });
    },
  });
  if (executors.length === 0) return { events: [], error: null, retry: () => undefined };
  return { ...visibleHistory(query.data, query.error), retry: () => void query.refetch() };
}
