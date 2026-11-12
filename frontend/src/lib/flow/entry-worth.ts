// U17 §1: what an LP deposit is worth the moment it lands, and how far that is from what was put in. The planners,
// the comparison, and the LP Confirm all read the position at the oracle BTC price (like the exposure maths and the
// charts), so a pool that prices BTC away from the oracle shows as a gap here instead of as a surprise on the chart.

import { STRESS_DROP } from "@/lib/compare/comparison";
import { lpValueAfterDrop } from "@/lib/exposure/exposure";
import { formatToken } from "@/lib/format";
import { WAD } from "@/lib/math";
import type { BtcEntryQuote, EntryQuote } from "@/lib/quote/entry";
import { PRICE_IMPACT_WARN } from "@/lib/routes/musd-btc-lp/gate";

export type EntryWorth = {
  /** MUSD: this deposit's LP share of the pool after the entry, its BTC at the oracle price. */
  value: bigint;
  /** BTC in that share. */
  btcShare: bigint;
  /** MUSD put in (a BTC entry: `btcIn × price`). */
  putIn: bigint;
  /** `putIn − value`; zero or negative when the position is worth at least what went in. */
  gap: bigint;
  /** The value after a 30% BTC fall (constant-product approximation, fees ignored). */
  valueAfterDrop: bigint;
  /** `putIn − valueAfterDrop`: the loss against what was put in. */
  lossAfterDrop: bigint;
};

/** The deposit's own share of the pool after the entry, valued at `price` (MUSD per BTC, 1e18). Rounds down. */
export function entryWorth(quote: Pick<EntryQuote, "liquidity" | "after">, price: bigint, putIn: bigint): EntryWorth {
  const { after, liquidity } = quote;
  const share = (reserve: bigint) => (after.totalSupply === 0n ? 0n : (liquidity * reserve) / after.totalSupply);
  const btcShare = share(after.reserveBtc);
  const value = share(after.reserveMusd) + (btcShare * price) / WAD;
  const valueAfterDrop = lpValueAfterDrop(value, STRESS_DROP);
  return { value, btcShare, putIn, gap: putIn - value, valueAfterDrop, lossAfterDrop: putIn - valueAfterDrop };
}

/** What the gap is made of; the planner's line and the Confirm row say it the same way. */
export const ENTRY_GAP_CAUSE = "MezoRoute fee, the pool's swap fee, and the pool's BTC price";

/**
 * The gap as figures, from 1% of what was put in (the price-impact warning's threshold). Null below it, when the
 * position is worth at least what went in (a gap is never shown as a gain), or when nothing was put in. Both figures
 * round up: this is a cost, and truncating would understate it (15.56% is "15.6%", not "15.5%").
 */
export function entryGap(worth: EntryWorth): { amount: string; percent: string } | null {
  if (worth.putIn <= 0n || worth.gap <= 0n) return null;
  const ratio = (worth.gap * WAD) / worth.putIn;
  if (ratio < PRICE_IMPACT_WARN) return null;
  return { amount: formatToken(worth.gap, 18, 2, "up"), percent: `${formatToken(ratio * 100n, 18, 1, "up")}%` };
}

/** The planner's sentence under "LP worth"; `putInLabel` is the amount as the user typed it ("1,000 MUSD"). */
export function entryGapLine(worth: EntryWorth, putInLabel: string): string | null {
  const gap = entryGap(worth);
  return gap && `≈ ${gap.amount} MUSD (${gap.percent}) below the ${putInLabel} you put in, at the BTC price: ${ENTRY_GAP_CAUSE}.`;
}

/**
 * What the price impact costs, in the token that is swapped. `priceImpact` is the swap's loss against the pre-trade
 * mid price (`quote/entry.ts`), so the cost is that share of the swapped amount.
 */
export function priceImpactCost(quote: EntryQuote | BtcEntryQuote): { amount: bigint; unit: "MUSD" | "BTC" } {
  return "btcIn" in quote
    ? { amount: (quote.btcToSwap * quote.priceImpact) / WAD, unit: "BTC" }
    : { amount: (quote.musdToSwap * quote.priceImpact) / WAD, unit: "MUSD" };
}
