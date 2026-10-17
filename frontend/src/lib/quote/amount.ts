import { parseUnits } from "viem";

// Optional integer part, optional fraction of at most 18 digits (MUSD has 18 decimals).
const DECIMAL = /^(\d+)?(?:\.(\d{0,18}))?$/;

/** Parses a typed MUSD amount. Returns null for empty, malformed, over-precise, or zero input. */
export function parseMusdAmount(input: string): bigint | null {
  const match = DECIMAL.exec(input.trim());
  if (!match || (match[1] === undefined && !match[2])) return null;
  const amount = parseUnits(`${match[1] ?? "0"}.${match[2] || "0"}`, 18);
  return amount > 0n ? amount : null;
}
