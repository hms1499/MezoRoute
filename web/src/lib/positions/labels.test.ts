import { describe, expect, it } from "vitest";
import { WAD } from "@/lib/math";
import { showsExitGap } from "./labels";

describe("showsExitGap", () => {
  it("explains a gap above 0.5% between the oracle value and the exit", () => {
    expect(showsExitGap(20_408n * 10n ** 14n, 19_966n * 10n ** 14n)).toBe(true); // 2.04 vs 1.9966 MUSD
  });

  it("stays quiet for a small gap, and for nothing at all", () => {
    expect(showsExitGap(1_000n * WAD, 998n * WAD)).toBe(false);
    expect(showsExitGap(0n, 0n)).toBe(false);
  });
});
