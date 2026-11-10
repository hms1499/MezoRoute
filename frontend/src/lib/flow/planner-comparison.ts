// U13 §Comparison card: the LP planner's aside compares the two routes for the typed amount. Pure, so the card stays a
// composition and the copy rules are tested here: the Stability Pool never gets an APR, a percentage, or a projection,
// and the LP side only ever quotes this week's rate (no promise about next week).

import { defaultCompareAmount } from "@/lib/compare/default-amount";
import type { StakeAvailability } from "@/lib/gauge/availability";
import { formatBps, formatPercent, formatToken } from "@/lib/format";

export type PlannerCompareRow = { label: string; value: string; sub?: string };
export type PlannerCompare = { lp: PlannerCompareRow[]; sp: PlannerCompareRow[] };

/** The comparison's footer: the same claim as F6's, never a second wording. */
export const PLANNER_COMPARE_NOTE = "No annualised rate. Withdrawals pause while any Trove is below MCR.";

/** A BTC entry cannot be compared with a MUSD-only pool (U13). */
export const BTC_COMPARE_MESSAGE = "The Stability Pool takes MUSD; switch the deposit to MUSD to compare.";

const INVALID_AMOUNT = "Enter a valid amount to compare.";

/**
 * Both routes as rows, for one block. `apr` and `weekly` are the page's own header figures, so the aside can never
 * disagree with the card; `poolFeeBps` is the chain's swap fee. No new maths lives here.
 */
export function plannerComparisonRows(input: {
  stake: { on: boolean; availability: StakeAvailability };
  apr: bigint | null;
  weekly: bigint | null;
  poolFeeBps: bigint;
}): PlannerCompare {
  const paying = input.stake.on && input.stake.availability === "open";
  const week =
    paying && input.apr !== null
      ? `≈ ${formatPercent(input.apr, 1)} APR`
      : paying && input.weekly !== null && input.weekly > 0n
        ? `≈ ${formatToken(input.weekly, 18, 2)} MEZO a week`
        : input.stake.availability === "between-weeks"
          ? "New week's rate not set yet"
          : `Pool fee ${formatBps(input.poolFeeBps)}`;
  return {
    lp: [
      { label: "You get", value: paying ? "Swap fees + MEZO" : "Swap fees" },
      { label: "This week", value: week },
      { label: "Held", value: "MUSD/BTC LP", sub: "About half your MUSD becomes BTC" },
    ],
    // Constants: the only dynamic Stability Pool fact is the amount, which lives in the card's badge and link.
    sp: [
      { label: "You get", value: "BTC from liquidations" },
      { label: "This week", value: "Variable · paid in bursts" },
      { label: "Held", value: "MUSD until a liquidation" },
    ],
  };
}

export type PlannerAmount =
  | { kind: "rows"; amountMusd: bigint; amountText: string; example: boolean }
  | { kind: "message"; message: string };

/**
 * What the comparison compares. A typed amount wins; an empty field falls back to `defaultCompareAmount`'s 1,000 MUSD
 * example (labelled as an example, never written to the URL); anything else — unparsable text or a zero — asks for a
 * valid amount instead of comparing nothing.
 */
export function plannerAmount(input: { text: string; musdIn: bigint | null; cap: bigint }): PlannerAmount {
  if (input.musdIn !== null && input.musdIn > 0n) {
    return { kind: "rows", amountMusd: input.musdIn, amountText: input.text.trim(), example: false };
  }
  if (input.text.trim() === "") {
    const example = defaultCompareAmount(0n, input.cap);
    // `defaultCompareAmount` returns whole MUSD in `text`; the example is always whole, so this is exact.
    return { kind: "rows", amountMusd: BigInt(example.text) * 10n ** 18n, amountText: example.text, example: true };
  }
  return { kind: "message", message: INVALID_AMOUNT };
}
