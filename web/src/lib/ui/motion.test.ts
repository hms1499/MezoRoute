import { describe, expect, it } from "vitest";
import { countUpAt, easeOutCubic, interpolateBigint, isRevealed } from "./motion";

describe("easeOutCubic", () => {
  it("runs from 0 to 1, fast first, and clamps outside the range", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 10);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
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
    expect(countUpAt(0n, 1_000n, 225, 450)).toBe(875n);
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
