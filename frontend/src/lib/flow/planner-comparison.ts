// U13 §Comparison card, U17 §2: both planners' aside compares the two routes for the typed amount. Pure, so the card
// stays a composition and the copy rules are tested here: the Stability Pool never gets an APR, a percentage return,
// or a projection, and the LP side only ever quotes this week's rate (no promise about next week).

import { defaultCompareAmount } from "@/lib/compare/default-amount";
import type { StakeAvailability } from "@/lib/gauge/availability";
import { emissionsApr, mezoPerWeek } from "@/lib/gauge/maths";
import type { GaugeState } from "@/lib/gauge/state";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { quoteEntry, type PoolState } from "@/lib/quote/entry";
import type { SavingsWeek } from "@/lib/savings/maths";
import { entryWorth } from "./entry-worth";

export type PlannerCompareRow = { label: string; value: string; sub?: string };
/** `savings` (U19): the Savings Vault, present only when its state could be read and the deposit is MUSD. */
export type PlannerCompare = { lp: PlannerCompareRow[]; sp: PlannerCompareRow[]; savings?: PlannerCompareRow[] };

/** The comparison's footer. The exit pause is its own row now (U17). */
export const PLANNER_COMPARE_NOTE = "No annualised rate for the Stability Pool.";

/** A BTC entry cannot be compared with a MUSD-only pool (U13). */
export const BTC_COMPARE_MESSAGE = "The Stability Pool takes MUSD; switch the deposit to MUSD to compare.";

const INVALID_AMOUNT = "Enter a valid amount to compare.";
const NO_QUOTE = "Pool quote unavailable";

/** The LP side's figures for one amount: the LP it mints, the BTC in that share, and its value after a 30% fall. */
export type PlannerLp = { liquidity: bigint; btcAdded: bigint; valueAfterDrop: bigint };

/**
 * U17 §2: the LP side for `amountMusd`, from the pool state alone, valued at the oracle price like the card. Both
 * planners call this with the same pool, so the same amount at the same block reads the same on both. Null when the
 * pool cannot quote (no reserves or supply).
 */
export function plannerLpFigures(input: { pool: PoolState; price: bigint; amountMusd: bigint; executorFeeBps: bigint }): PlannerLp | null {
  const quote = quoteEntry(input.pool, input.amountMusd, input.executorFeeBps);
  if (!quote) return null;
  const worth = entryWorth(quote, input.price, input.amountMusd);
  return { liquidity: quote.liquidity, btcAdded: worth.btcShare, valueAfterDrop: worth.valueAfterDrop };
}

/**
 * This week's rate for `liquidity` LP in the gauge. Both are null unless the week pays; the APR needs no amount (it is
 * the rate on the staked value) but does need a MEZO price, and the MEZO a week needs the amount.
 */
export function lpWeekRate(input: {
  gauge: Pick<GaugeState, "rewardRate" | "totalStaked"> | null;
  availability: StakeAvailability;
  mezoPrice: bigint | null;
  liquidity: bigint | null;
  pool: PoolState;
}): { apr: bigint | null; weekly: bigint | null } {
  const { gauge, pool } = input;
  if (input.availability !== "open" || gauge === null) return { apr: null, weekly: null };
  return {
    weekly: input.liquidity === null ? null : mezoPerWeek(gauge.rewardRate, input.liquidity, gauge.totalStaked),
    apr: emissionsApr({
      rewardRate: gauge.rewardRate,
      mezoPrice: input.mezoPrice,
      userLp: input.liquidity ?? 0n,
      totalStaked: gauge.totalStaked,
      pool: { reserveMusd: pool.reserveMusd, reserveBtc: pool.reserveBtc, balanceMusd: pool.reserveMusd, balanceBtc: pool.reserveBtc, totalSupply: pool.totalSupply },
    }),
  };
}

/**
 * U18 §4: the LP side for the amount the comparison compares: its figures, then this week's rate for that same LP.
 * Both planners use it, so an empty field's 1,000 MUSD example gets a MEZO rate instead of "unavailable".
 */
export function plannerLpSide(input: {
  pool: PoolState;
  price: bigint;
  amountMusd: bigint;
  executorFeeBps: bigint;
  gauge: Pick<GaugeState, "rewardRate" | "totalStaked"> | null;
  availability: StakeAvailability;
  mezoPrice: bigint | null;
}): { lp: PlannerLp | null; apr: bigint | null; weekly: bigint | null } {
  const lp = plannerLpFigures(input);
  return { lp, ...lpWeekRate({ gauge: input.gauge, availability: input.availability, mezoPrice: input.mezoPrice, liquidity: lp?.liquidity ?? null, pool: input.pool }) };
}

/**
 * Both routes as rows, for one block: what each gives, this week's rate, the BTC it adds, what a 30% BTC fall leaves,
 * and how it exits. `stake.on` is the applied wish (`effectiveStake`), so "You get" always agrees with the card's
 * Staking row: staked LP earns MEZO and its swap fees go to veBTC voters, whether or not the week's rate is set.
 */
export function plannerComparisonRows(input: {
  amountMusd: bigint;
  stake: { on: boolean; availability: StakeAvailability };
  apr: bigint | null;
  weekly: bigint | null;
  poolFeeBps: bigint;
  lp: PlannerLp | null;
}): PlannerCompare {
  const { stake } = input;
  const paying = stake.on && stake.availability === "open";
  const week =
    paying && input.apr !== null
      ? `≈ ${formatPercent(input.apr, 1)} APR`
      : paying && input.weekly !== null && input.weekly > 0n
        ? `≈ ${formatToken(input.weekly, 18, 2)} MEZO a week`
        : stake.on
          ? stake.availability === "between-weeks"
            ? "New week's rate not set yet"
            : "This week's rate unavailable"
          : `Pool fee ${formatBps(input.poolFeeBps)}`;
  return {
    lp: [
      stake.on ? { label: "You get", value: "MEZO", sub: "swap fees go to veBTC voters" } : { label: "You get", value: "Swap fees" },
      { label: "This week", value: week },
      { label: "BTC exposure", value: input.lp ? `+${formatToken(input.lp.btcAdded)} BTC` : NO_QUOTE },
      { label: "If BTC −30%", value: input.lp ? `≈ ${formatToken(input.lp.valueAfterDrop, 18, 2)} MUSD` : NO_QUOTE },
      { label: "Exit", value: "Any time, at the pool price" },
    ],
    sp: [
      { label: "You get", value: "BTC from liquidations" },
      { label: "This week", value: "Variable · paid in bursts" },
      { label: "BTC exposure", value: "None until a liquidation" },
      { label: "If BTC −30%", value: `${formatToken(input.amountMusd, 18, 2)} MUSD`, sub: "new liquidations not modelled" },
      { label: "Exit", value: "Paused while any Trove is below MCR" },
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

/**
 * U19: Mezo's Savings Vault for the same amount. Staked sMUSD earns this week's MEZO and gives its MUSD yield to the
 * gauge, so the week's line says "staked"; without a paying week it is the variable MUSD yield, never projected.
 */
export function plannerSavingsRows(input: { amountMusd: bigint; week: SavingsWeek | null }): PlannerCompareRow[] {
  const { week } = input;
  const thisWeek =
    week?.availability === "open" && week.apr !== null
      ? `≈ ${formatPercent(week.apr, 1)} APR staked`
      : week?.availability === "open" && week.mezoPerWeek !== null && week.mezoPerWeek > 0n
        ? `≈ ${formatToken(week.mezoPerWeek, 18, 2)} MEZO a week staked`
        : "MUSD yield · variable";
  return [
    { label: "You get", value: "MUSD yield", sub: "or MEZO if staked" },
    { label: "This week", value: thisWeek },
    { label: "BTC exposure", value: "None" },
    { label: "If BTC −30%", value: `${formatToken(input.amountMusd, 18, 2)} MUSD` },
    { label: "Exit", value: "Any time, 1:1, in the Mezo app" },
  ];
}
