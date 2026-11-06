// U11 §6.1: the amount field's arithmetic, kept pure so the BTC gas reserve (Review Focus 2) is tested on its own.

import type { Token } from "@/components/ui/TokenIcon";

/** What an amount field holds: a token, or the pool's LP (the exit). */
export type FlowToken = Token | "lp";

export const FLOW_TOKEN_UNIT: Record<FlowToken, string> = { musd: "MUSD", btc: "BTC", mezo: "MEZO", lp: "LP" };

/** Digits a balance line shows: MUSD to the cent, the rest to six places (as the route pages did before U11). */
export const FLOW_TOKEN_DIGITS: Record<FlowToken, number> = { musd: 2, btc: 6, mezo: 6, lp: 6 };

export type TokenAmountMax = { max: bigint } | { blocked: "gas-price-unknown" };

/**
 * What Max may fill: the balance less the gas reserve. `reserve === null` means the gas price is unknown, which blocks
 * (a zero reserve would let Max spend the gas). The caller passes `0n` for MUSD.
 */
export function tokenAmountMax(balance: bigint, reserve: bigint | null): TokenAmountMax {
  if (reserve === null) return { blocked: "gas-price-unknown" };
  return { max: balance > reserve ? balance - reserve : 0n };
}
