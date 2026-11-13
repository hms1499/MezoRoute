import { keepPreviousData } from "@tanstack/react-query";
import type { NetworkConfig } from "@/lib/config/networks";

/**
 * The vault read's query options (U19 review). It waits for the snapshot's block, so even the first read is pinned to
 * it, and keeps the last state while the next block's read is in flight: without that the sMUSD column and blocks
 * vanished for a moment on every 15–30 s refresh, reflowing the table and the mobile tabs.
 */
export function savingsVaultQuery(network: NetworkConfig, blockNumber: bigint | undefined) {
  return { enabled: network.savingsVault !== null && blockNumber !== undefined, retry: false, placeholderData: keepPreviousData };
}
