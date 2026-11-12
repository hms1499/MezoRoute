import { STRESS_DROP } from "@/lib/compare/comparison";
import { amountState, signedChange } from "@/lib/compare/view";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { WAD } from "@/lib/math";
import type { MainnetReferenceData } from "@/lib/reference/load";
import { referenceView } from "@/lib/reference/snapshot";
import type { LandingSimulation } from "./simulate";

export type LiveStrip =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "data"; caption: string; poolValue: bigint; lpFees: { value: string; sub: string } | null; spDeposits: bigint; spShare: string };

/** Shown above the strip: its figures are mainnet on both networks and describe the past (§9). */
export const STRIP_CAPTION = "Live from Mezo mainnet. Past results, not a forecast.";

/** The landing's live strip: skeletons while loading, nothing on error (the page stays complete). */
export function liveStrip(data: MainnetReferenceData | undefined, error: Error | null): LiveStrip {
  if (data) {
    const view = referenceView(data.reference);
    const lp = data.backtests?.lp;
    const rate = lp ? formatPercent(lp.feeRate, 1) : "";
    return {
      kind: "data",
      caption: STRIP_CAPTION,
      poolValue: view.poolTvl,
      lpFees: lp ? { value: formatPercent(lp.feeReturn, 2), sub: `${rate.startsWith("<") ? "" : "≈"}${rate} a year, fees only` } : null,
      spDeposits: data.reference.spDeposits,
      spShare: formatPercent(view.spShare, 1),
    };
  }
  return error ? { kind: "hidden" } : { kind: "loading" };
}

/** "14.17M MUSD" from a million up, otherwise whole MUSD with grouping. */
export function compactMusd(value: bigint): string {
  return value >= 1_000_000n * WAD ? `${formatToken(value, 24, 2)}M MUSD` : `${formatToken(value, 18, 0)} MUSD`;
}

/** A text cell; `figure` marks a number written as text, which the simulator sets in mono like the counting figures. */
export type SimCell = { kind: "text"; text: string; figure?: true } | { kind: "figure"; value: bigint; format: (value: bigint) => string };
export type SimRow = { label: string; lp: SimCell; sp: SimCell; lpTone?: "btc" };

const text = (value: string): SimCell => ({ kind: "text", text: value });
const figureText = (value: string): SimCell => ({ kind: "text", text: value, figure: true });
const figure = (value: bigint, format: (value: bigint) => string): SimCell => ({ kind: "figure", value, format });
const musd = (value: bigint) => `${formatToken(value, 18, 2)} MUSD`;

/** The simulator table: one row per question, one column per route, so like values line up. */
export function simulatorRows(sim: LandingSimulation): SimRow[] {
  const bt = sim.backtests;
  const quoteMissing = text("Pool quote unavailable");
  return [
    { label: "Return source", lp: text("Swap fees, or MEZO if staked"), sp: text("Liquidation BTC") },
    {
      label: "Last 30 days",
      lp: bt?.lp ? figureText(signedChange(bt.lp.valueNow, sim.amount)) : text("Unavailable"),
      sp: !bt ? text("Unavailable") : bt.sp.liquidated ? figureText(signedChange(bt.sp.valueNow, sim.amount)) : text("No liquidations"),
    },
    {
      label: "BTC exposure",
      lp: sim.lp.status === "ok" ? figure(sim.lp.btcAdded, (v) => `≈ +${formatToken(v)} BTC`) : quoteMissing,
      sp: figureText("0 BTC"),
      lpTone: "btc",
    },
    {
      label: `If BTC −${STRESS_DROP}%`,
      lp: sim.lp.status === "ok" ? figure(sim.lp.valueAfterDrop, (v) => `≈ ${musd(v)}`) : quoteMissing,
      sp: figure(sim.sp.valueAfterDrop, musd),
    },
    { label: "MezoRoute fee", lp: figureText(formatBps(sim.executorFeeBps)), sp: text("None") },
  ];
}

export const SIMULATOR_FOOTNOTE =
  "Past 30 days on Mezo mainnet, not a forecast. Estimates in MUSD. Max 1,000 MUSD per transaction on mainnet.";

export function simulatorNotes(sim: LandingSimulation): string[] {
  const notes = [SIMULATOR_FOOTNOTE];
  if (sim.overCap) notes.push("Above the mainnet limit of 1,000 MUSD per transaction.");
  return notes;
}

/** U17 §7: said under the simulator's heading on testnet, where it is read before the figures, not after them. */
export const SIMULATOR_TESTNET_NOTE = "You're on Testnet: these figures are Mezo mainnet; your transactions will use test tokens.";

/** The landing's default and example amount (the mainnet entry cap). */
export const LANDING_EXAMPLE = 1_000n * WAD;

/**
 * The simulator's field: the typed text, its parsed amount (null while empty, zero, or invalid), and the amount the
 * figures show. U17 §4: with nothing valid typed the figures are the labelled 1,000 MUSD example, never the previous
 * amount, which read as the result for a field that no longer held it.
 */
export type AmountState = { text: string; amount: bigint | null; error: string | null; shown: bigint; example: boolean };

export function landingAmount(text: string): AmountState {
  const { amount, error } = amountState(text);
  return { text, amount, error, shown: amount ?? LANDING_EXAMPLE, example: amount === null };
}

/** The table's caption: which amount the figures are for. */
export function simulatorCaption(amount: bigint, example: boolean): string {
  return `Both routes for ${formatToken(amount, 18, 2)} MUSD${example ? " (example)" : ", estimated"}`;
}
