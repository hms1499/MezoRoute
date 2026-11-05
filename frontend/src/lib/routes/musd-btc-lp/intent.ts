import { parseMusdAmount } from "@/lib/quote/amount";
import { DEFAULT_SLIPPAGE, type SlippageBps } from "@/lib/quote/entry";
import { parseEntryAsset, type EntryAsset } from "./asset";

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

/**
 * What the user asked for (`stake` is the wish: the page applies the gauge's availability); the only state the LP
 * pages pass between them (in the URL). `amount` is in `asset`: it parses to `musdIn` for MUSD and `btcIn` for BTC,
 * and the other is null. Both assets have 18 decimals.
 */
export type EntryIntent = {
  amount: string;
  asset: EntryAsset;
  musdIn: bigint | null;
  btcIn: bigint | null;
  slippageBps: SlippageBps;
  mode: EntryMode;
  stake: boolean;
};

/** The typed amount in the intent's own asset. */
export function intentAmount(intent: Pick<EntryIntent, "asset" | "musdIn" | "btcIn">): bigint | null {
  return intent.asset === "btc" ? intent.btcIn : intent.musdIn;
}

export function parseEntryIntent(params: { get(name: string): string | null }): EntryIntent {
  const amount = params.get("amount") ?? "";
  const mode: EntryMode = params.get("mode") === "borrow" ? "borrow" : "deposit";
  const asset = parseEntryAsset(params.get("asset"), mode);
  const parsed = parseMusdAmount(amount);
  return {
    amount,
    asset,
    musdIn: asset === "musd" ? parsed : null,
    btcIn: asset === "btc" ? parsed : null,
    slippageBps: parseSlippage(params.get("slippage")),
    mode,
    stake: params.get("stake") !== "0",
  };
}

/** The query both LP pages share: the user's inputs only, never quote values. */
export function entryQuery(intent: { amount: string; slippageBps: SlippageBps; mode?: EntryMode; stake?: boolean; asset?: EntryAsset }): string {
  const query = new URLSearchParams();
  if (intent.amount) query.set("amount", intent.amount);
  query.set("slippage", slippageParam(intent.slippageBps));
  if (intent.mode === "borrow") query.set("mode", "borrow");
  if (intent.stake === false) query.set("stake", "0");
  if (intent.asset === "btc" && intent.mode !== "borrow") query.set("asset", "btc");
  return `?${query.toString()}`;
}
