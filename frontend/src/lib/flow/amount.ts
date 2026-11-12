// U11 §6.1: the amount field's arithmetic, kept pure so the BTC gas reserve (Review Focus 2) is tested on its own.

import { formatUnits } from "viem";
import type { Token } from "@/components/ui/TokenIcon";
import { amountState } from "@/lib/compare/view";

/** What an amount field holds: a token, or the pool's LP (the exit). */
export type FlowToken = Token | "lp";

export const FLOW_TOKEN_UNIT: Record<FlowToken, string> = { musd: "MUSD", btc: "BTC", mezo: "MEZO", lp: "LP" };

/** Digits a balance line shows: MUSD to the cent, the rest to six places (as the route pages did before U11). */
export const FLOW_TOKEN_DIGITS: Record<FlowToken, number> = { musd: 2, btc: 6, mezo: 6, lp: 6 };

/**
 * Digits Max fills: the precision each flow already shows, so the field never holds eighteen decimals of wei dust.
 * BTC keeps eight (the BTC entry's figures do) and MUSD four (the flow's `musd` formatter).
 */
export const MAX_FILL_DIGITS: Record<FlowToken, number> = { musd: 4, btc: 8, mezo: 4, lp: 6 };

/** The balance as an input value, floored to `MAX_FILL_DIGITS` (never rounded up, which would exceed the balance). */
export function maxFillAmount(max: bigint, token: FlowToken): string {
  if (max <= 0n) return "0";
  const digits = MAX_FILL_DIGITS[token];
  const step = 10n ** BigInt(18 - digits);
  const [whole, fraction = ""] = formatUnits((max / step) * step, 18).split(".");
  const kept = fraction.slice(0, digits).replace(/0+$/, "");
  return kept ? `${whole}.${kept}` : whole;
}

export type TokenAmountMax = { max: bigint } | { blocked: "gas-price-unknown" };

/**
 * What Max may fill: the balance less the gas reserve. `reserve === null` means the gas price is unknown, which blocks
 * (a zero reserve would let Max spend the gas). The caller passes `0n` for MUSD.
 */
export function tokenAmountMax(balance: bigint, reserve: bigint | null): TokenAmountMax {
  if (reserve === null) return { blocked: "gas-price-unknown" };
  return { max: balance > reserve ? balance - reserve : 0n };
}

const BTC_AMOUNT_ERROR = "Enter a BTC amount like 0.01 (up to 18 decimals).";

/**
 * U17 §4: a message for text that can never be an amount ("abc", "-5", "1,000", nineteen decimals). Null for an
 * amount, an empty field, or a zero in any spelling: those are "no amount yet", which the page shows without an error.
 */
export function amountFieldError(text: string, token: "musd" | "btc"): string | null {
  const { error } = amountState(text);
  return error === null ? null : token === "btc" ? BTC_AMOUNT_ERROR : error;
}

/**
 * What the URL may carry: the text as typed (trimmed, so the query never holds `+7+`), or nothing when it can never be
 * an amount (a reload must not bring it back). The field keeps the raw text, so typing a space is not undone.
 */
export function urlAmount(text: string): string {
  return amountState(text).error === null ? text.trim() : "";
}
