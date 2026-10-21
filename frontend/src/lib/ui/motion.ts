// U10 (spec 2026-10-21-u10-motion-system-landing-design.md): one easing curve and three durations for the whole
// app, written once here. `tailwind.config.ts` turns them into CSS variables and utilities (`ease-smooth`,
// `duration-fast|base|slow`); `motion-guard.test.ts` fails on any other curve or numeric duration in the source.

/** Morpho's curve for every transition; `swift` only for the button's arrow swap. */
export const EASE = { smooth: [0.36, 0.2, 0.07, 1], swift: [0.2, 0, 0, 1] } as const;

/** Small controls, buttons, reveals; plus the named one-offs (countdown tick, the stepper's "Done", settle stagger). */
export const MOTION_MS = { fast: 200, base: 400, slow: 600, tick: 1000, doneFlash: 1200, settleStagger: 60 } as const;

/** The landing's long one-off timings (chart draw, timeline, live pulse, value flash, count-ups). */
export const LANDING_MOTION_MS = {
  chartDraw: 1200,
  timeline: 1400,
  livePulse: 1800,
  valueFlash: 700,
  simulatorCount: 450,
  liveCount: 1100,
} as const;

const curve = (points: readonly number[]) => `cubic-bezier(${points.join(", ")})`;

/** The CSS variables the Tailwind plugin writes on `:root`. */
export function motionVariables(): Record<string, string> {
  return {
    "--ease-smooth": curve(EASE.smooth),
    "--ease-swift": curve(EASE.swift),
    "--motion-fast": `${MOTION_MS.fast}ms`,
    "--motion-base": `${MOTION_MS.base}ms`,
    "--motion-slow": `${MOTION_MS.slow}ms`,
    "--motion-stagger": `${MOTION_MS.settleStagger}ms`,
  };
}

/** Keyframes for tailwind.config.ts; each runs only behind `motion-safe:` (or the no-preference media block). */
export const MOTION_KEYFRAMES = {
  breathe: { from: { opacity: "1" }, to: { opacity: "0.45" } },
  "toast-in": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
  "dot-wave": { "0%, 100%": { opacity: "0.25", transform: "translateY(0)" }, "40%": { opacity: "1", transform: "translateY(-3px)" } },
  "roll-in": { from: { opacity: "0", transform: "translateY(100%)" } },
  settle: { from: { opacity: "0", transform: "translateY(8px)" } },
};

export const MOTION_ANIMATIONS = {
  breathe: "breathe 1.6s var(--ease-smooth) infinite alternate",
  "toast-in": "toast-in var(--motion-fast) var(--ease-smooth)",
  "dot-wave": "dot-wave 1s var(--ease-smooth) infinite",
  "roll-in": "roll-in var(--motion-base) var(--ease-smooth) backwards",
  // `backwards`, never `both`: a fill that outlives the animation keeps a stacking context (it buried Term popovers).
  settle: "settle var(--motion-slow) var(--ease-smooth) backwards",
};

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** A CSS `cubic-bezier(x1, y1, x2, y2)` as a function of progress (0–1, clamped): solves x(s) = t, returns y(s). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const at = (a: number, b: number, s: number) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s ** 2 * b + s ** 3;
  return (t) => {
    const x = clamp01(t);
    if (x === 0 || x === 1) return x;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

/** The app's curve in JavaScript, for count-ups that cannot use CSS. */
export const easeSmooth = cubicBezier(...EASE.smooth);

const STEPS = 1_000_000n;

/** A bigint between `from` and `to` at progress `t` (0–1); exact at both ends. */
export function interpolateBigint(from: bigint, to: bigint, t: number): bigint {
  const k = BigInt(Math.round(Math.min(1, Math.max(0, t)) * Number(STEPS)));
  return from + ((to - from) * k) / STEPS;
}

/** The value a count-up shows `elapsedMs` into a `durationMs` animation; a zero duration shows the target. */
export function countUpAt(from: bigint, to: bigint, elapsedMs: number, durationMs: number): bigint {
  if (durationMs <= 0) return to;
  return interpolateBigint(from, to, easeSmooth(elapsedMs / durationMs));
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
