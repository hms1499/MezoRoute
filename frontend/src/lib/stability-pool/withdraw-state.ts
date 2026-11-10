/** What the withdraw page shows (U14 B6): an empty state, a gain-only claim, or the withdraw form. */
export function spWithdrawState(deposit: bigint, gain: bigint): "empty" | "gain-only" | "form" {
  if (deposit > 0n) return "form";
  return gain > 0n ? "gain-only" : "empty";
}
