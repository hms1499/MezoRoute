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

/**
 * Whether a scroll-reveal section should show: `threshold` of it is visible, or, for a section taller
 * than the viewport, it fills `threshold` of the viewport. A ratio alone never reaches 0.3 for a
 * section over 3.3 viewports tall (400% zoom, short landscape screens), so it would stay hidden.
 */
export function isRevealed(
  entry: { isIntersecting: boolean; ratio: number; visibleHeight: number; rootHeight: number },
  threshold: number,
): boolean {
  if (!entry.isIntersecting) return false;
  return entry.ratio >= threshold || entry.visibleHeight >= threshold * entry.rootHeight;
}
