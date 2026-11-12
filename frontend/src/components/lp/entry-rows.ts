// U17 §1: the LP card's risk rows and its "You receive" block, from the entry's worth. Pure, so the page stays a
// composition and the copy rules (the loss is against what was put in; a gap is never a gain) are tested here.

import { entryGapLine, priceImpactCost, type EntryWorth } from "@/lib/flow/entry-worth";
import { formatPercent } from "@/lib/format";
import type { BtcEntryQuote, EntryQuote } from "@/lib/quote/entry";
import { PRICE_IMPACT_WARN } from "@/lib/routes/musd-btc-lp/gate";
import { btc, btcFine, lp, musd } from "./units";

type Row = { label: string; value: string; sub?: string; tone?: "btc" | "warning" };

const SWAP_FEE_NOTE = "includes the pool's swap fee";

/**
 * The BTC this entry adds, and under it what a 30% BTC fall leaves against the MUSD put in. A BTC entry gets no
 * MUSD figure: the BTC it deposits would have fallen in the wallet too.
 */
export function lpExposureRow(input: { exposureChange: bigint; worth: EntryWorth | null; fromBtc: boolean }): Row {
  const { exposureChange: change, worth } = input;
  const value = `${change < 0n ? "−" : "+"}${btc(change < 0n ? -change : change)}`;
  const sub = input.fromBtc
    ? "pool share only; the BTC you deposit leaves your wallet"
    : worth && worth.lossAfterDrop > 0n
      ? `If BTC −30%: ≈ −${musd(worth.lossAfterDrop)}`
      : undefined;
  return sub === undefined ? { label: "BTC exposure", value, tone: "btc" } : { label: "BTC exposure", value, sub, tone: "btc" };
}

/** The price impact; from 1% it reads as a warning and says what it costs. */
export function priceImpactRow(quote: EntryQuote | BtcEntryQuote): Row {
  const value = formatPercent(quote.priceImpact, 2);
  if (quote.priceImpact < PRICE_IMPACT_WARN) return { label: "Price impact", value, sub: SWAP_FEE_NOTE };
  const cost = priceImpactCost(quote);
  return { label: "Price impact", value, sub: `≈ ${cost.unit === "BTC" ? btcFine(cost.amount) : musd(cost.amount)} · ${SWAP_FEE_NOTE}`, tone: "warning" };
}

/** "You receive": the LP's value in MUSD first, the token count and guaranteed minimum on one line, then the gap. */
export function lpReceive(input: { worth: EntryWorth; liquidity: bigint; minLpOut: bigint; putInLabel: string }): {
  value: string;
  minimum: string;
  note: string | null;
} {
  return {
    value: `LP worth ≈ ${musd(input.worth.value)}`,
    minimum: `≈ ${lp(input.liquidity)} · at least ${lp(input.minLpOut)}`,
    note: entryGapLine(input.worth, input.putInLabel),
  };
}
