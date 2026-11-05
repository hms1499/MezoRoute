import { describe, expect, it } from "vitest";
import { effectiveStake, showsGaugeCard, stakeAvailability, UNFUNDED_AFTER_SECONDS } from "./availability";
import type { GaugeState } from "./state";

const NOW = 1_000_000n;
const gauge = (overrides: Partial<GaugeState> = {}): GaugeState => ({
  alive: true,
  rewardRate: 10n ** 15n,
  periodFinish: NOW + 3_600n,
  totalStaked: 0n,
  staked: 0n,
  earned: 0n,
  ...overrides,
});

describe("stakeAvailability", () => {
  it("reports availability", () => {
    expect(stakeAvailability(gauge(), NOW)).toBe("open");
    expect(stakeAvailability(gauge({ periodFinish: NOW }), NOW)).toBe("between-weeks");
    expect(stakeAvailability(gauge({ periodFinish: NOW - 1n }), NOW)).toBe("between-weeks");
    expect(stakeAvailability(gauge({ alive: false }), NOW)).toBe("unavailable");
    expect(stakeAvailability(null, NOW)).toBe("unavailable");
  });
});

describe("an alive gauge nobody funds (Ruling P22)", () => {
  it("is 8 days", () => {
    expect(UNFUNDED_AFTER_SECONDS).toBe(691_200n);
  });

  it("stays between weeks up to 8 days past periodFinish", () => {
    expect(stakeAvailability(gauge({ periodFinish: NOW - UNFUNDED_AFTER_SECONDS }), NOW)).toBe("between-weeks");
  });

  it("is unavailable past that, so a deposit no longer defaults to no MEZO and no swap fees", () => {
    const unfunded = stakeAvailability(gauge({ periodFinish: NOW - UNFUNDED_AFTER_SECONDS - 1n }), NOW);
    expect(unfunded).toBe("unavailable");
    expect(effectiveStake(true, unfunded)).toBe(false);
  });
});

describe("showsGaugeCard", () => {
  const unfunded = { periodFinish: NOW - UNFUNDED_AFTER_SECONDS - 1n };

  it("shows for wallet LP only while staking is possible", () => {
    expect(showsGaugeCard(gauge(), 5n, NOW)).toBe(true);
    expect(showsGaugeCard(gauge({ periodFinish: NOW - 1n }), 5n, NOW)).toBe(true);
    expect(showsGaugeCard(gauge(unfunded), 5n, NOW)).toBe(false);
    expect(showsGaugeCard(gauge({ alive: false }), 5n, NOW)).toBe(false);
    expect(showsGaugeCard(gauge(), 0n, NOW)).toBe(false);
  });

  it("keeps showing while LP is staked or MEZO is pending, so claim and unstake stay reachable on an unfunded or dead gauge", () => {
    expect(showsGaugeCard(gauge({ ...unfunded, staked: 1n }), 0n, NOW)).toBe(true);
    expect(showsGaugeCard(gauge({ ...unfunded, earned: 1n }), 0n, NOW)).toBe(true);
    expect(showsGaugeCard(gauge({ alive: false, staked: 1n }), 0n, NOW)).toBe(true);
  });

  it("does not show without a gauge", () => {
    expect(showsGaugeCard(null, 5n, NOW)).toBe(false);
  });
});

describe("effectiveStake", () => {
  it("never stakes when unavailable, whatever the URL says", () => {
    expect(effectiveStake(true, "unavailable")).toBe(false);
    expect(effectiveStake(false, "unavailable")).toBe(false);
  });

  it("follows the URL when staking is possible, including between weeks", () => {
    expect(effectiveStake(true, "open")).toBe(true);
    expect(effectiveStake(false, "open")).toBe(false);
    expect(effectiveStake(true, "between-weeks")).toBe(true);
  });
});
