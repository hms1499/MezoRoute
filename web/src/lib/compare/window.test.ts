import { describe, expect, it } from "vitest";
import { annualise, pastBlock, REF_SPAN } from "./window";

describe("pastBlock", () => {
  it("steps back 30 days at the average block time of the last REF_SPAN blocks", () => {
    // 3.922 s per block: 2,592,000 s × 600,000 / 2,353,200 s = 660,887 blocks (rounded down).
    expect(REF_SPAN).toBe(600_000n);
    expect(pastBlock(12_518_862n, 1_792_028_137n, 1_792_028_137n - 2_353_200n)).toBe(11_857_975n);
  });

  it("rejects timestamps that do not increase", () => {
    expect(() => pastBlock(12_518_862n, 1_000n, 1_000n)).toThrow();
  });

  it("rejects a chain younger than the window", () => {
    expect(() => pastBlock(700_000n, 1_000_000n, 1_000_000n - 1_000n)).toThrow();
  });
});

describe("annualise", () => {
  it("scales a ratio to 365 days, simple and rounded down", () => {
    expect(annualise(10n ** 15n, 2_499_138n)).toBe(12_618_750_945_325_948n);
  });

  it("rejects an empty window", () => {
    expect(() => annualise(1n, 0n)).toThrow();
  });
});
