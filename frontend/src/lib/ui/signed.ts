/** U11 §5.5: the colour role of a signed financial figure (a 30-day result, a P&L); zero has none. */
export function signedTone(value: bigint): "positive" | "negative" | null {
  if (value > 0n) return "positive";
  if (value < 0n) return "negative";
  return null;
}
