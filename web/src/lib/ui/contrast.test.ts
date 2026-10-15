import { describe, expect, it } from "vitest";
import { contrastRatio, mix } from "./contrast";
import { TEXT_PAIRS } from "./tokens";

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#0F766E", "#FFFFFF")).toBeCloseTo(5.47, 2);
  });

  it("does not depend on the order of the colours", () => {
    expect(contrastRatio("#FFFFFF", "#1F2A2E")).toBeCloseTo(contrastRatio("#1F2A2E", "#FFFFFF"), 10);
  });
});

describe("design tokens", () => {
  it.each(TEXT_PAIRS)("%s reaches WCAG AA (4.5:1)", (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("mix", () => {
  it("blends a colour over a background at an opacity", () => {
    expect(mix("#000000", "#FFFFFF", 1)).toBe("#000000");
    expect(mix("#000000", "#FFFFFF", 0)).toBe("#FFFFFF");
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });
});
