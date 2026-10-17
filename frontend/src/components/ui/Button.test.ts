import { describe, expect, it } from "vitest";
import { buttonClass } from "./Button";

describe("button style roles", () => {
  it("keeps the filled landing alias aligned with primary", () => {
    expect(buttonClass("primary")).toContain("bg-accent text-onAccent");
    expect(buttonClass("night")).toContain("bg-accent text-onAccent");
    expect(buttonClass("night")).toContain("min-h-11");
  });

  it("keeps the outlined landing alias aligned with secondary geometry", () => {
    const secondary = buttonClass("secondary");
    const nightOutline = buttonClass("nightOutline");
    expect(secondary).toContain("ring-1 ring-inset");
    expect(nightOutline).toContain("ring-1 ring-inset");
    expect(secondary).toContain("min-h-11");
    expect(nightOutline).toContain("min-h-11");
    expect(nightOutline).toContain("ring-accent");
  });

  it("keeps the quiet landing alias aligned with ghost", () => {
    expect(buttonClass("ghost")).toContain("text-accent hover:bg-accent-soft");
    expect(buttonClass("nightGhost")).toContain("text-muted hover:text-ink");
    expect(buttonClass("nightGhost")).toContain("min-h-11");
  });

  it("keeps compact buttons at least 36 px tall", () => {
    expect(buttonClass("primary", "sm")).toContain("min-h-9");
    expect(buttonClass("nightOutline", "sm")).toContain("min-h-9");
  });
});
