import { describe, expect, it } from "vitest";
import { WAD } from "@/lib/math";
import { plannerHref } from "./links";

describe("plannerHref (U16)", () => {
  it("carries the simulator amount into the LP planner as a plain decimal", () => {
    expect(plannerHref("lp", 1_000n * WAD)).toBe("/route/lp/?amount=1000");
    expect(plannerHref("lp", 12_345n * WAD)).toBe("/route/lp/?amount=12345");
  });

  it("keeps fractions without grouping or trailing zeros", () => {
    expect(plannerHref("lp", 2_500_000_000_000_000_000n)).toBe("/route/lp/?amount=2.5");
  });

  it("sends the Stability Pool to its own route page", () => {
    expect(plannerHref("sp", 500n * WAD)).toBe("/route/stability-pool/?amount=500");
  });

  it("plans without an amount (U17: the simulator's example state)", () => {
    expect(plannerHref("lp", null)).toBe("/route/lp/");
    expect(plannerHref("sp", null)).toBe("/route/stability-pool/");
  });
});
