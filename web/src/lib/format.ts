import { formatUnits } from "viem";

/**
 * A token amount for display: truncated to `fractionDigits` by default (so a balance is never
 * overstated), or rounded up when understating would flatter the user (debt, liquidation price);
 * trailing zeros dropped, thousands separated. A non-zero amount that would truncate to zero shows
 * as "<0.000001" (or "<1" with no fraction digits), so a small gas balance never reads as empty.
 */
export function formatToken(
  value: bigint,
  decimals = 18,
  fractionDigits = 6,
  rounding: "down" | "up" = "down",
): string {
  const shown = rounding === "up" ? roundUp(value, decimals, fractionDigits) : value;
  const [whole, fraction = ""] = formatUnits(shown, decimals).split(".");
  const kept = fraction.slice(0, fractionDigits).replace(/0+$/, "");
  if (shown > 0n && whole === "0" && kept === "") {
    return fractionDigits === 0 ? "<1" : `<0.${"0".repeat(fractionDigits - 1)}1`;
  }
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return kept ? `${grouped}.${kept}` : grouped;
}

function roundUp(value: bigint, decimals: number, fractionDigits: number): bigint {
  if (fractionDigits >= decimals) return value;
  const step = 10n ** BigInt(decimals - fractionDigits);
  return ((value + step - 1n) / step) * step;
}

/** A 1e18 ratio as a percentage, truncated: 1.509e18 → "150.9%". */
export function formatPercent(ratio: bigint, fractionDigits = 1): string {
  return `${formatToken(ratio * 100n, 18, fractionDigits)}%`;
}

/** First 6 and last 4 characters, for EVM and Bitcoin addresses alike. */
export function shortAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}
