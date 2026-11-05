"use client";

import { useReadContract } from "wagmi";
import { clPoolAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";
import { mezoPriceFromSlot0 } from "./maths";

/**
 * MUSD per MEZO at `blockNumber`, read from the price pool's slot0 in its own request (the pool is a
 * different contract type from the snapshot's reads, and a failure must not fail the snapshot).
 * Null without a price pool, without a block, or on any failure. Display only.
 */
export function useMezoPrice(network: NetworkConfig, blockNumber: bigint | undefined): bigint | null {
  const pool = network.mezoPricePool;
  const read = useReadContract({
    chainId: network.chainId,
    address: pool?.address,
    abi: clPoolAbi,
    functionName: "slot0",
    blockNumber,
    query: { enabled: pool !== null && blockNumber !== undefined, retry: false },
  });
  if (!pool || read.error || !read.data) return null;
  return mezoPriceFromSlot0(read.data[0], pool.mezoIsToken0);
}
