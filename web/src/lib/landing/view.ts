import { STRESS_DROP } from "@/lib/compare/comparison";
import { signedChange } from "@/lib/compare/view";
import type { NetworkId } from "@/lib/config/networks";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { WAD } from "@/lib/math";
import type { MainnetReferenceData } from "@/lib/reference/load";
import { referenceView } from "@/lib/reference/snapshot";
import type { LandingSimulation } from "./simulate";

export type LiveStrip =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "data"; poolValue: bigint; lpFees: { value: string; sub: string } | null; spDeposits: bigint; spShare: string };

/** The landing's live strip: skeletons while loading, nothing on error (the page stays complete). */
export function liveStrip(data: MainnetReferenceData | undefined, error: Error | null): LiveStrip {
  if (data) {
    const view = referenceView(data.reference);
    const lp = data.backtests?.lp;
    const rate = lp ? formatPercent(lp.feeRate, 1) : "";
    return {
      kind: "data",
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

export type SimCell = { kind: "text"; text: string } | { kind: "figure"; value: bigint; format: (value: bigint) => string };
export type SimRow = { label: string; lp: SimCell; sp: SimCell; lpTone?: "btc" };

const text = (value: string): SimCell => ({ kind: "text", text: value });
const figure = (value: bigint, format: (value: bigint) => string): SimCell => ({ kind: "figure", value, format });
const musd = (value: bigint) => `${formatToken(value, 18, 2)} MUSD`;

/** The simulator table: one row per question, one column per route, so like values line up. */
export function simulatorRows(sim: LandingSimulation): SimRow[] {
  const bt = sim.backtests;
  const quoteMissing = text("Pool quote unavailable");
  return [
    { label: "Return source", lp: text("Swap fees"), sp: text("Liquidation BTC") },
    {
      label: "Last 30 days",
      lp: text(bt?.lp ? signedChange(bt.lp.valueNow, sim.amount) : "Unavailable"),
      sp: text(!bt ? "Unavailable" : bt.sp.liquidated ? signedChange(bt.sp.valueNow, sim.amount) : "No liquidations"),
    },
    {
      label: "BTC exposure",
      lp: sim.lp.status === "ok" ? figure(sim.lp.btcAdded, (v) => `+${formatToken(v)} BTC`) : quoteMissing,
      sp: text("0 BTC"),
      lpTone: "btc",
    },
    {
      label: `If BTC −${STRESS_DROP}%`,
      lp: sim.lp.status === "ok" ? figure(sim.lp.valueAfterDrop, (v) => `≈ ${musd(v)}`) : quoteMissing,
      sp: figure(sim.sp.valueAfterDrop, musd),
    },
    { label: "MezoRoute fee", lp: text(formatBps(sim.executorFeeBps)), sp: text("None") },
  ];
}

export const SIMULATOR_FOOTNOTE =
  "Past 30 days on Mezo mainnet, not a forecast. Estimates in MUSD. Max 1,000 MUSD per transaction on mainnet.";

export function simulatorNotes(sim: LandingSimulation, networkId: NetworkId): string[] {
  const notes = [SIMULATOR_FOOTNOTE];
  if (sim.overCap) notes.push("Above the mainnet limit of 1,000 MUSD per transaction.");
  if (networkId === "testnet") notes.push("You're on Testnet: these figures are Mezo mainnet; your transactions will use test tokens.");
  return notes;
}
