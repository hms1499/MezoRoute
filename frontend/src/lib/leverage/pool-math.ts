const BPS = 10_000n;

const netOfFee = (x: bigint, feeBps: bigint) => x - (x * feeBps) / BPS;

/**
 * The smallest input the Tigris volatile pool's K check accepts for `amountOut`, with the fee taken on
 * input; bit for bit `MezoRouteLeverage.exactInput`, so a quote never pays the pool less than the
 * contract will.
 */
export function exactInput(reserveIn: bigint, reserveOut: bigint, amountOut: bigint, feeBps: bigint): bigint {
  if (amountOut <= 0n || amountOut >= reserveOut) throw new Error("exactInput: output out of range");
  const product = reserveIn * reserveOut;
  const remaining = reserveOut - amountOut;
  const need = (product + remaining - 1n) / remaining - reserveIn;
  let x = (need * BPS + (BPS - feeBps) - 1n) / (BPS - feeBps);
  while (x > 0n && netOfFee(x - 1n, feeBps) >= need) x -= 1n;
  while (netOfFee(x, feeBps) < need) x += 1n;
  return x;
}
