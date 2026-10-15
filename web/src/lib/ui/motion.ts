/** Ease-out cubic on 0–1, clamped. */
export function easeOutCubic(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return 1 - (1 - k) ** 3;
}

const STEPS = 1_000_000n;

/** A bigint between `from` and `to` at progress `t` (0–1); exact at both ends. */
export function interpolateBigint(from: bigint, to: bigint, t: number): bigint {
  const k = BigInt(Math.round(Math.min(1, Math.max(0, t)) * Number(STEPS)));
  return from + ((to - from) * k) / STEPS;
}

/** The value a count-up shows `elapsedMs` into a `durationMs` animation; a zero duration shows the target. */
export function countUpAt(from: bigint, to: bigint, elapsedMs: number, durationMs: number): bigint {
  if (durationMs <= 0) return to;
  return interpolateBigint(from, to, easeOutCubic(elapsedMs / durationMs));
}
