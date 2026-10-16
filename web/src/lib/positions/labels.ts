/**
 * Whether the LP card explains why "Exit to MUSD now" is below "Value at the BTC price" (U3 §5.6):
 * the exit sells the BTC half at the pool price, which can sit away from the oracle.
 */
export function showsExitGap(valueAtPrice: bigint, exitMusd: bigint): boolean {
  if (valueAtPrice === 0n) return false;
  const gap = valueAtPrice > exitMusd ? valueAtPrice - exitMusd : exitMusd - valueAtPrice;
  return gap * 1000n > valueAtPrice * 5n;
}
