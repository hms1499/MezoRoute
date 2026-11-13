import {
  backtestRoutes,
  fetchRouteHistory,
  HISTORY_TIMEOUT_MS,
  withTimeout,
  type HistoryClient,
  type RouteBacktests,
  type RouteHistory,
} from "@/lib/compare/history";
import { REFERENCE_AMOUNT } from "@/lib/compare/view";
import { networks } from "@/lib/config/networks";
import { fetchSavingsIndexes } from "@/lib/savings/history";
import { savingsReturn } from "@/lib/savings/maths";
import { parseSavingsState, savingsContracts } from "@/lib/savings/state";
import { parseReference, referenceContracts, type MainnetReference, type ReferenceResults } from "./snapshot";

/** U19: the Savings Vault's supply, sMUSD staked for MEZO, and its MUSD yield over F6's window (null when unread). */
export type ReferenceSavings = { supply: bigint; staked: bigint | null; ret: bigint | null; seconds: bigint | null };

export type MainnetReferenceData = { reference: MainnetReference; backtests: RouteBacktests | null; history: RouteHistory | null; savings: ReferenceSavings | null };

/**
 * The head figures and F6's 30-day history, fetched side by side (spec F8 §4): a failed head read
 * fails the card; a failed history read (no archive state, timeout) only blanks the 30-day rows.
 */
export async function loadMainnetReference(client: HistoryClient, timeoutMs = HISTORY_TIMEOUT_MS): Promise<MainnetReferenceData> {
  const network = networks.mainnet;
  // The vault's reads carry the selected network's chainId for wagmi; this card's own client sends them without it.
  const vaultReads = (savingsContracts(network) as readonly { chainId?: number }[]).map(({ chainId: _chainId, ...read }) => read);
  const [head, history, vault] = await Promise.allSettled([
    withTimeout(
      client.multicall({ contracts: referenceContracts(network), allowFailure: false, multicallAddress: network.addresses.multicall3 }),
      timeoutMs,
    ),
    withTimeout(fetchRouteHistory(client, network), timeoutMs),
    withTimeout(client.multicall({ contracts: vaultReads, allowFailure: false, multicallAddress: network.addresses.multicall3 }), timeoutMs),
  ]);
  if (head.status === "rejected") throw head.reason;
  const savings = await referenceSavings(client, vault, history.status === "fulfilled" ? history.value : null, timeoutMs);
  return {
    reference: parseReference(network, head.value as unknown as ReferenceResults),
    backtests: history.status === "fulfilled" ? backtestRoutes(history.value, REFERENCE_AMOUNT, 0n) : null,
    history: history.status === "fulfilled" ? history.value : null,
    savings,
  };
}

/** A failed vault read leaves the card without the vault; a failed 30-day read leaves only its line blank. */
async function referenceSavings(
  client: HistoryClient,
  vault: PromiseSettledResult<readonly unknown[]>,
  history: RouteHistory | null,
  timeoutMs: number,
): Promise<ReferenceSavings | null> {
  const network = networks.mainnet;
  if (vault.status === "rejected") return null;
  const state = parseSavingsState(network, vault.value);
  let ret: bigint | null = null;
  if (history) {
    try {
      const indexes = await withTimeout(fetchSavingsIndexes(client, network, history.pastBlock, history.headBlock), timeoutMs);
      ret = savingsReturn(indexes.past, indexes.now);
    } catch {
      ret = null;
    }
  }
  return { supply: state.totalSupply, staked: state.gauge?.totalStaked ?? null, ret, seconds: history && ret !== null ? history.headTime - history.pastTime : null };
}
