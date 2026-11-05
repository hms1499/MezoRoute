import { describe, expect, it } from "vitest";
import { STAKE_TITLE, stakeLines } from "./copy";

describe("stake copy", () => {
  it("says the rate is this week's and that swap fees go to veBTC voters", () => {
    expect(STAKE_TITLE).toBe("Stake to earn MEZO");
    expect(stakeLines("open", 1_500_000_000_000_000_000n)).toEqual([
      "≈ 1.5 MEZO a week at this week's rate. While staked, swap fees go to veBTC voters instead of you.",
    ]);
  });

  it("stakes between weeks without a rate", () => {
    const lines = stakeLines("between-weeks", null).join(" ");
    expect(lines).toContain("The new week's MEZO rate is not set yet. Staking still works.");
    expect(lines).toContain("swap fees go to veBTC voters");
    expect(lines).not.toMatch(/≈|a week at/);
  });

  it("asks for an amount in an open week without one, and does not claim the rate is unset", () => {
    expect(stakeLines("open", null)).toEqual([
      "Enter an amount to see this week's rate. While staked, swap fees go to veBTC voters instead of you.",
    ]);
  });

  it("has no copy when staking is unavailable", () => {
    expect(stakeLines("unavailable", null)).toEqual([]);
  });
});
