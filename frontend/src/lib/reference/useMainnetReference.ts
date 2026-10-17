"use client";

import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, type PublicClient } from "viem";
import type { HistoryClient } from "@/lib/compare/history";
import { networks } from "@/lib/config/networks";
import { loadMainnetReference, type MainnetReferenceData } from "./load";

const STALE_MS = 5 * 60_000;

// The wagmi config only knows the selected network, so the testnet dashboard reads mainnet through its
// own client, built once on first use (never in render).
let client: PublicClient | undefined;
function mainnetClient(): PublicClient {
  client ??= createPublicClient({ transport: http(networks.mainnet.rpcUrl) });
  return client;
}

export function useMainnetReference(enabled: boolean): {
  data: MainnetReferenceData | undefined;
  error: Error | null;
  retry: () => void;
} {
  const query = useQuery({
    queryKey: ["mainnet-reference"],
    enabled,
    staleTime: STALE_MS,
    retry: false,
    queryFn: () => loadMainnetReference(mainnetClient() as unknown as HistoryClient),
  });
  return { data: query.data, error: query.error, retry: () => void query.refetch() };
}
