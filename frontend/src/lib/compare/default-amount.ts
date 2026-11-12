import { WAD } from "@/lib/math";
import { parseMusdAmount } from "@/lib/quote/amount";

/** The example amount when the wallet holds less than 1 MUSD: the landing's default, equal to the mainnet cap. */
const EXAMPLE = 1_000n * WAD;

/**
 * Compare routes starts filled (U3 §5.2): the wallet's MUSD floored to whole MUSD and capped by the
 * network's entry cap, or a 1,000 MUSD example (`example: true`) below 1 MUSD.
 */
export function defaultCompareAmount(walletMusd: bigint, cap: bigint): { text: string; example: boolean } {
  if (walletMusd < WAD) return { text: (EXAMPLE / WAD).toString(), example: true };
  const whole = (walletMusd < cap ? walletMusd : cap) / WAD;
  return { text: whole.toString(), example: false };
}

/** The 30-day comparison page for an amount as typed; the bare page without one. */
export function compareHref(amountText: string): string {
  return amountText ? `/compare/?amount=${encodeURIComponent(amountText)}` : "/compare/";
}

/**
 * U17 §6: where the comparison starts. A valid `?amount=` wins and is the visitor's own amount (never labelled an
 * example); anything else falls back to `defaultCompareAmount` (the wallet's MUSD, or the 1,000 MUSD example).
 */
export function compareStart(param: string | null, walletMusd: bigint, cap: bigint): { text: string; example: boolean } {
  const text = param?.trim() ?? "";
  return parseMusdAmount(text) !== null ? { text, example: false } : defaultCompareAmount(walletMusd, cap);
}

/** "More than your wallet holds" needs a wallet: without one the balance is unknown, not zero. */
export function showsOverBalance(input: { connected: boolean; overBalance: boolean; example: boolean }): boolean {
  return input.connected && input.overBalance && !input.example;
}
