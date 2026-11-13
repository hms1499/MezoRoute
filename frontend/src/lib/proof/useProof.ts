"use client";

import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, type PublicClient } from "viem";
import type { NetworkConfig, NetworkId } from "@/lib/config/networks";
import { browserFetchJson } from "@/lib/stability-pool/explorer";
import { loadProofRows } from "./load";
import type { ProofRow } from "./rows";

// The Proof page reads either network whatever the app's own network is, so it never goes through wagmi: logs come
// from the explorer API and the head block from a viem client per network, built once on first use (never in render).
const clients: Partial<Record<NetworkId, PublicClient>> = {};
function clientFor(network: NetworkConfig): PublicClient {
  clients[network.id] ??= createPublicClient({ transport: http(network.rpcUrl) });
  return clients[network.id]!;
}

export function useProof(network: NetworkConfig): { rows: ProofRow[] | undefined; error: Error | null; retry: () => Promise<unknown> } {
  const query = useQuery({
    queryKey: ["proof-rows", network.id],
    retry: false,
    staleTime: Infinity,
    queryFn: () => loadProofRows(network, browserFetchJson),
  });
  return { rows: query.data, error: query.error, retry: () => query.refetch() };
}

/** The head block when the page read it, for "Block N · read Xs ago"; undefined while unknown or failed. */
export function useHeadBlock(network: NetworkConfig): { block: { number: bigint; readAt: number } | undefined; refresh: () => Promise<unknown> } {
  const query = useQuery({
    queryKey: ["proof-head", network.id],
    retry: false,
    staleTime: Infinity,
    queryFn: async () => ({ number: await clientFor(network).getBlockNumber(), readAt: Date.now() }),
  });
  return { block: query.data, refresh: () => query.refetch() };
}
