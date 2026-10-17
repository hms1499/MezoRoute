import { parseMusdAmount } from "@/lib/quote/amount";
import { DEFAULT_SLIPPAGE, type SlippageBps } from "@/lib/quote/entry";

const SLIPPAGE_BY_PARAM: Record<string, SlippageBps> = { "0.5": 50n, "1": 100n, "2": 200n };
const PARAM_BY_SLIPPAGE: Record<string, string> = { "50": "0.5", "100": "1", "200": "2" };

/** A slippage preset from its URL value; anything else is the default (never raised silently). */
export function parseSlippage(param: string | null): SlippageBps {
  return param !== null && Object.hasOwn(SLIPPAGE_BY_PARAM, param) ? SLIPPAGE_BY_PARAM[param] : DEFAULT_SLIPPAGE;
}

export function slippageParam(bps: SlippageBps): string {
  return PARAM_BY_SLIPPAGE[bps.toString()];
}

export type EntryMode = "deposit" | "borrow";

/** What the user asked for; the only state the LP pages pass between them (in the URL). */
export type EntryIntent = { amount: string; musdIn: bigint | null; slippageBps: SlippageBps; mode: EntryMode };

export function parseEntryIntent(params: { get(name: string): string | null }): EntryIntent {
  const amount = params.get("amount") ?? "";
  return {
    amount,
    musdIn: parseMusdAmount(amount),
    slippageBps: parseSlippage(params.get("slippage")),
    mode: params.get("mode") === "borrow" ? "borrow" : "deposit",
  };
}

/** The query both LP pages share: the user's inputs only, never quote values. */
export function entryQuery(intent: { amount: string; slippageBps: SlippageBps; mode?: EntryMode }): string {
  const query = new URLSearchParams();
  if (intent.amount) query.set("amount", intent.amount);
  query.set("slippage", slippageParam(intent.slippageBps));
  if (intent.mode === "borrow") query.set("mode", "borrow");
  return `?${query.toString()}`;
}
