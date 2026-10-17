import { WAD } from "@/lib/math";

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
