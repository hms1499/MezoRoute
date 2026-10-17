/** 1e18: the fixed-point unit of every token amount, price, and ratio in the app. */
export const WAD = 10n ** 18n;

/** Floor of the square root of a non-negative bigint (Newton's method). */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError("isqrt of a negative number");
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/** a / b rounded up, for non-negative a and positive b. */
export function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}
