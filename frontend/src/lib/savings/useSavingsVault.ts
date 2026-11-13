"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useReadContracts } from "wagmi";
import { HISTORY_TIMEOUT_MS, withTimeout, type HistoryClient, type RouteHistory } from "@/lib/compare/history";
import type { NetworkConfig } from "@/lib/config/networks";
import { fetchSavingsIndexes } from "./history";
import { parseSavingsState, savingsContracts, type SavingsState } from "./state";

/**
 * The vault and its gauge at `blockNumber` (the neighbouring snapshot's block, so the figures share one block), in
 * their own request: a failure here hides only the sMUSD figures. Undefined while loading; null without a vault or on
 * any failure.
 */
export function useSavingsVault(network: NetworkConfig, blockNumber: bigint | undefined): SavingsState | null | undefined {
  const read = useReadContracts({
    // Two tuple shapes (with or without a gauge) defeat wagmi's inference; the parser reads them by position.
    contracts: savingsContracts(network) as never,
    allowFailure: false,
    blockNumber,
    query: { enabled: network.savingsVault !== null, retry: false },
  });
  if (!network.savingsVault || read.error) return null;
  if (!read.data) return undefined;
  return parseSavingsState(network, read.data as readonly unknown[]);
}

/** The vault's index at F6's two blocks, once the route history has them; null on failure (only sMUSD's 30-day rows blank). */
export function useSavingsHistory(network: NetworkConfig, history: RouteHistory | undefined): { past: bigint; now: bigint } | null | undefined {
  const client = usePublicClient({ chainId: network.chainId });
  const query = useQuery({
    queryKey: ["savings-history", network.chainId, history?.pastBlock.toString(), history?.headBlock.toString()],
    enabled: client !== undefined && history !== undefined && network.savingsVault !== null,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: () => withTimeout(fetchSavingsIndexes(client as unknown as HistoryClient, network, history!.pastBlock, history!.headBlock), HISTORY_TIMEOUT_MS),
  });
  if (!network.savingsVault || query.error) return null;
  return query.data;
}
