import { parseMusdAmount } from "@/lib/quote/amount";
import { DEFAULT_SLIPPAGE, type SlippageBps } from "@/lib/quote/entry";

/** What the user asked for; the only state the LP pages pass between them (in the URL). */
export type EntryIntent = { amount: string; musdIn: bigint | null; slippageBps: SlippageBps };

const SLIPPAGE_BY_PARAM: Record<string, SlippageBps> = { "0.5": 50n, "1": 100n, "2": 200n };
const PARAM_BY_SLIPPAGE: Record<string, string> = { "50": "0.5", "100": "1", "200": "2" };

export function parseEntryIntent(params: { get(name: string): string | null }): EntryIntent {
  const amount = params.get("amount") ?? "";
  const slippage = params.get("slippage") ?? "";
  return {
    amount,
    musdIn: parseMusdAmount(amount),
    slippageBps: Object.hasOwn(SLIPPAGE_BY_PARAM, slippage) ? SLIPPAGE_BY_PARAM[slippage] : DEFAULT_SLIPPAGE,
  };
}

/** The query both LP pages share: the user's inputs only, never quote values. */
export function entryQuery(intent: { amount: string; slippageBps: SlippageBps }): string {
  const query = new URLSearchParams();
  if (intent.amount) query.set("amount", intent.amount);
  query.set("slippage", PARAM_BY_SLIPPAGE[intent.slippageBps.toString()]);
  return `?${query.toString()}`;
}
