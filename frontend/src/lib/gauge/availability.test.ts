import { describe, expect, it } from "vitest";
import { effectiveStake, stakeAvailability } from "./availability";
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
