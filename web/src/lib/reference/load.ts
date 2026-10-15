import {
  backtestRoutes,
  fetchRouteHistory,
  HISTORY_TIMEOUT_MS,
  withTimeout,
  type HistoryClient,
  type RouteBacktests,
} from "@/lib/compare/history";
import { REFERENCE_AMOUNT } from "@/lib/compare/view";
import { networks } from "@/lib/config/networks";
import { parseReference, referenceContracts, type MainnetReference, type ReferenceResults } from "./snapshot";

export type MainnetReferenceData = { reference: MainnetReference; backtests: RouteBacktests | null };

/**
 * The head figures and F6's 30-day history, fetched side by side (spec F8 §4): a failed head read
 * fails the card; a failed history read (no archive state, timeout) only blanks the 30-day rows.
 */
export async function loadMainnetReference(client: HistoryClient, timeoutMs = HISTORY_TIMEOUT_MS): Promise<MainnetReferenceData> {
  const network = networks.mainnet;
  const [head, history] = await Promise.allSettled([
    withTimeout(
      client.multicall({ contracts: referenceContracts(network), allowFailure: false, multicallAddress: network.addresses.multicall3 }),
      timeoutMs,
    ),
    withTimeout(fetchRouteHistory(client, network), timeoutMs),
  ]);
  if (head.status === "rejected") throw head.reason;
  return {
    reference: parseReference(network, head.value as unknown as ReferenceResults),
    backtests: history.status === "fulfilled" ? backtestRoutes(history.value, REFERENCE_AMOUNT, 0n) : null,
  };
}
