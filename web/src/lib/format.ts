import { formatUnits } from "viem";

/**
 * A token amount for display: truncated (never rounded up, so a balance is never overstated) to
 * `fractionDigits`, trailing zeros dropped, thousands separated. A non-zero amount that would
 * truncate to zero shows as "<0.000001", so a small gas balance never reads as empty.
 */
export function formatToken(value: bigint, decimals = 18, fractionDigits = 6): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const kept = fraction.slice(0, fractionDigits).replace(/0+$/, "");
  if (value > 0n && whole === "0" && kept === "") return `<0.${"0".repeat(fractionDigits - 1)}1`;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return kept ? `${grouped}.${kept}` : grouped;
}

/** First 6 and last 4 characters, for EVM and Bitcoin addresses alike. */
export function shortAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}
