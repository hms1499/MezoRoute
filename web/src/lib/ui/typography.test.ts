import { describe, expect, it } from "vitest";
import { CHART_FONT_PX, fontSize } from "./tokens";

// U6 (spec 2026-10-17-u6-type-scale-design.md): one type scale, defined once in tokens.ts.

const DISPLAY = new Set(["display", "display-lg"]);

describe("type tokens", () => {
  it("is exactly the spec's scale", () => {
    expect(fontSize).toEqual({
      xs: ["12px", { lineHeight: "16px" }],
      sm: ["14px", { lineHeight: "20px" }],
      base: ["16px", { lineHeight: "24px" }],
      xl: ["20px", { lineHeight: "28px" }],
      headline: ["24px", { lineHeight: "32px", fontWeight: "600", letterSpacing: "-0.025em" }],
      title: ["28px", { lineHeight: "34px", fontWeight: "600", letterSpacing: "-0.025em" }],
      figure: ["28px", { lineHeight: "32px", fontWeight: "500", letterSpacing: "-0.025em" }],
      display: ["40px", { lineHeight: "48px", fontWeight: "700", letterSpacing: "-0.025em" }],
      "display-lg": ["48px", { lineHeight: "52px", fontWeight: "700", letterSpacing: "-0.025em" }],
    });
  });

  it("never goes below 12 px", () => {
    for (const [size] of Object.values(fontSize)) expect(parseFloat(size)).toBeGreaterThanOrEqual(12);
    expect(CHART_FONT_PX).toBe(12);
  });

  it("uses weight 700 only for the display tokens", () => {
    for (const [key, [, meta]] of Object.entries(fontSize)) {
      const weight = "fontWeight" in meta ? meta.fontWeight : undefined;
      if (weight === undefined) continue;
      expect(DISPLAY.has(key) ? ["700"] : ["400", "500", "600"]).toContain(weight);
    }
  });
});
