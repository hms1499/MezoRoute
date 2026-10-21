import { describe, expect, it } from "vitest";
import { countUpAt, cubicBezier, easeSmooth, interpolateBigint, isRevealed, LANDING_MOTION_MS, MOTION_KEYFRAMES, MOTION_MS, motionVariables } from "./motion";

describe("motion tokens (U10)", () => {
  it("has one curve's three durations and the named one-offs", () => {
    expect(MOTION_MS).toEqual({ fast: 200, base: 400, slow: 600, tick: 1000, doneFlash: 1200, settleStagger: 60 });
  });

  it("writes the CSS variables from the same values", () => {
    expect(motionVariables()).toEqual({
      "--ease-smooth": "cubic-bezier(0.36, 0.2, 0.07, 1)",
      "--ease-swift": "cubic-bezier(0.2, 0, 0, 1)",
      "--motion-fast": "200ms",
      "--motion-base": "400ms",
      "--motion-slow": "600ms",
    });
  });

  it("replaces the shimmer with the breathing skeleton", () => {
    expect(Object.keys(MOTION_KEYFRAMES).sort()).toEqual(["breathe", "dot-wave", "roll-in", "settle", "toast-in"]);
  });
});

describe("landing motion timings", () => {
  it("keeps only the long one-off timings", () => {
    expect(LANDING_MOTION_MS).toEqual({
      chartDraw: 1200,
      timeline: 1400,
      livePulse: 1800,
      valueFlash: 700,
      simulatorCount: 450,
      liveCount: 1100,
    });
  });
});

describe("easeSmooth", () => {
  it("evaluates cubic-bezier(0.36, 0.2, 0.07, 1)", () => {
    expect(easeSmooth(0)).toBe(0);
    expect(easeSmooth(1)).toBe(1);
    expect(easeSmooth(0.25)).toBeCloseTo(0.4716, 3);
    expect(easeSmooth(0.5)).toBeCloseTo(0.8704, 3);
    for (let i = 1; i <= 100; i++) expect(easeSmooth(i / 100)).toBeGreaterThanOrEqual(easeSmooth((i - 1) / 100));
  });

  it("clamps outside 0–1", () => {
    expect(easeSmooth(-1)).toBe(0);
    expect(easeSmooth(2)).toBe(1);
  });

  it("is the identity for a linear bezier", () => {
    expect(cubicBezier(0.25, 0.25, 0.75, 0.75)(0.3)).toBeCloseTo(0.3, 4);
  });
});

describe("interpolateBigint", () => {
  it("lands exactly on both ends, in either direction", () => {
    expect(interpolateBigint(100n, 1_000n, 0)).toBe(100n);
    expect(interpolateBigint(100n, 1_000n, 1)).toBe(1_000n);
    expect(interpolateBigint(1_000n, 100n, 1)).toBe(100n);
    expect(interpolateBigint(0n, 10n ** 24n, 0.5)).toBe(5n * 10n ** 23n);
  });
});

describe("countUpAt", () => {
  it("eases from the start value to the target over the duration", () => {
    expect(countUpAt(0n, 1_000n, 0, 450)).toBe(0n);
    expect(countUpAt(0n, 1_000n, 225, 450)).toBe(870n); // easeSmooth(0.5) ≈ 0.8704
    expect(countUpAt(0n, 1_000n, 450, 450)).toBe(1_000n);
    expect(countUpAt(0n, 1_000n, 9_000, 450)).toBe(1_000n);
  });

  it("shows the target at once with no duration (reduced motion)", () => {
    expect(countUpAt(0n, 1_000n, 0, 0)).toBe(1_000n);
  });
});

describe("isRevealed", () => {
  const root = 640;
  it("reveals once 30% of the section is visible", () => {
    expect(isRevealed({ isIntersecting: true, ratio: 0.3, visibleHeight: 120, rootHeight: root }, 0.3)).toBe(true);
    expect(isRevealed({ isIntersecting: true, ratio: 0.1, visibleHeight: 40, rootHeight: root }, 0.3)).toBe(false);
  });

  it("reveals a section taller than the viewport once it fills 30% of the viewport (400% zoom, short screens)", () => {
    expect(isRevealed({ isIntersecting: true, ratio: 0.08, visibleHeight: 200, rootHeight: root }, 0.3)).toBe(true);
  });

  it("never reveals what is not on screen", () => {
    expect(isRevealed({ isIntersecting: false, ratio: 0, visibleHeight: 0, rootHeight: root }, 0.3)).toBe(false);
  });
});
