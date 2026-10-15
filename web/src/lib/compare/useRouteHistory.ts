"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { fetchRouteHistory, HISTORY_TIMEOUT_MS, withTimeout, type HistoryClient, type RouteHistory } from "./history";

/** 30-day results barely move within minutes; one fetch per 10 minutes is enough. */
const STALE_MS = 10 * 60_000;

/** The two-block history for the comparison card. A failure affects only the 30-day rows (spec F6 §2). */
export function useRouteHistory(): { history: RouteHistory | undefined; error: Error | null; retry: () => void } {
  const { network } = useNetwork();
  const client = usePublicClient({ chainId: network.chainId });
  const query = useQuery({
    queryKey: ["route-history", network.chainId],
    enabled: client !== undefined,
    staleTime: STALE_MS,
    retry: false,
    queryFn: () => withTimeout(fetchRouteHistory(client as unknown as HistoryClient, network), HISTORY_TIMEOUT_MS),
  });
  return { history: query.data, error: query.error, retry: () => void query.refetch() };
}
