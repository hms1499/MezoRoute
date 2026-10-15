import { formatPercent, formatToken } from "@/lib/format";
import { WAD } from "@/lib/math";
import { parseMusdAmount } from "@/lib/quote/amount";
import type { LpBacktest } from "./lp-backtest";
import type { SpBacktest } from "./sp-backtest";

/** The backtest's amount while the field is empty. */
export const REFERENCE_AMOUNT = 1_000n * WAD;

const AMOUNT_ERROR = "Enter an MUSD amount like 20 or 20.5 (up to 18 decimals).";
/** Empty or zero in any spelling: no amount yet, and no error. */
const ZERO = /^0*\.?0*$/;

export function amountState(text: string): { amount: bigint | null; error: string | null } {
  const trimmed = text.trim();
  const amount = parseMusdAmount(trimmed);
  if (amount !== null) return { amount, error: null };
  return { amount: null, error: ZERO.test(trimmed) ? null : AMOUNT_ERROR };
}

export function lpHistoryLine(bt: LpBacktest): string {
  const rate = formatPercent(bt.feeRate, 1);
  return `Fees ${formatPercent(bt.feeReturn, 2)} (${rate.startsWith("<") ? "" : "≈"}${rate} a year, fees only)`;
}

/** Stability Pool returns arrive in bursts, so a yearly rate from one window would mislead (spec F6). */
export function spHistoryLine(bt: SpBacktest): string {
  if (!bt.liquidated) return "No liquidations reached the pool";
  return `BTC gains ${formatPercent(bt.gainReturn, 2)} · deposit absorbed ${formatPercent(bt.lossReturn, 2)}`;
}

export function signedChange(valueNow: bigint, amount: bigint): string {
  const negative = valueNow < amount;
  const diff = negative ? amount - valueNow : valueNow - amount;
  const sign = negative ? "−" : "+";
  return `${sign}${formatToken(diff, 18, 2)} MUSD (${sign}${formatPercent((diff * WAD) / amount, 2)})`;
}

export function windowDate(unixSeconds: bigint): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Number(unixSeconds) * 1000),
  );
}

export function windowDays(seconds: bigint): number {
  return Math.round(Number(seconds) / 86_400);
}
