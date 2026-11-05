import { describe, expect, it } from "vitest";
import {
  feesStakedNote,
  GAUGE_NOT_FUNDED,
  GAUGE_READ_FAILED_ENTRY,
  GAUGE_READ_FAILED_EXIT,
  GAUGE_READ_FAILED_EXPOSURE,
  GAUGE_READ_FAILED_POSITIONS,
  GAUGE_READ_FAILED_RETRY,
  gaugeRateLine,
  STAKE_TITLE,
  stakeLines,
} from "./copy";

describe("a failed gauge read", () => {
  const all = [GAUGE_READ_FAILED_ENTRY, GAUGE_READ_FAILED_EXIT, GAUGE_READ_FAILED_EXPOSURE, GAUGE_READ_FAILED_POSITIONS, GAUGE_READ_FAILED_RETRY];

  it("says the read failed, never that there is no gauge or no staked LP", () => {
    for (const line of all) {
      expect(line).toMatch(/could not be read/);
      expect(line).not.toMatch(/\bno (gauge|staked)\b|not staked yet|has no gauge/i);
    }
  });

  it("tells Positions readers what is missing and that wallet LP can still exit", () => {
    expect(GAUGE_READ_FAILED_POSITIONS).toMatch(/Staked LP and pending MEZO/);
    expect(GAUGE_READ_FAILED_POSITIONS).toMatch(/wallet can still exit/);
  });
});

describe("GAUGE_NOT_FUNDED", () => {
  it("says why staked LP earns nothing there and points to the way out", () => {
    expect(GAUGE_NOT_FUNDED).toMatch(/no new MEZO and no swap fees/);
    expect(GAUGE_NOT_FUNDED).toMatch(/Unstake/);
  });
});

describe("gaugeRateLine", () => {
  it("gives this week's amount while the week pays", () => {
    expect(gaugeRateLine("open", 1_500_000_000_000_000_000n)).toBe("≈ 1.5 MEZO a week");
    expect(gaugeRateLine("open", null)).toBe("—");
  });

  it("does not promise a new week's rate on a gauge that is not being funded", () => {
    expect(gaugeRateLine("between-weeks", null)).toBe("Not set for the new week yet");
    expect(gaugeRateLine("unavailable", null)).toBe("None: not being funded");
  });
});

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

describe("feesStakedNote", () => {
  const none = { musd: 0n, btc: 0n };
  it("says no pool fees accrue when all LP is staked and none is claimable", () => {
    expect(feesStakedNote({ walletLp: 0n, stakedLp: 5n, fees: none })).toBe(
      "Your LP is all staked, so it earns no pool fees: swap fees go to veBTC voters.",
    );
  });
  it("stays silent when some LP is in the wallet, nothing is staked, or fees are waiting", () => {
    expect(feesStakedNote({ walletLp: 1n, stakedLp: 5n, fees: none })).toBeNull();
    expect(feesStakedNote({ walletLp: 0n, stakedLp: 0n, fees: none })).toBeNull();
    expect(feesStakedNote({ walletLp: 0n, stakedLp: 5n, fees: { musd: 1n, btc: 0n } })).toBeNull();
  });
});
