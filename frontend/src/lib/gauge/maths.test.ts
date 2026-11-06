import { describe, expect, it } from "vitest";
import { emissionsApr, gaugeWeekOpen, lpValueInMusd, mezoPerWeek, mezoPriceFromSlot0 } from "./maths";

// Mainnet figures at 4 Nov 2026.
const pool = {
  reserveMusd: 58334540240955650544200n,
  reserveBtc: 743642742729788206n,
  balanceMusd: 58334540240955650544200n,
  balanceBtc: 743642742729788206n,
  totalSupply: 208278755424436519615n,
};
const rewardRate = 481122999331598803n;
const totalStaked = 171862531852085332718n;
const mezoPrice = 6038609436909955n;

describe("gauge maths", () => {
  it("has no MEZO price from a zero sqrtPriceX96, and no APR from a zero price", () => {
    expect(mezoPriceFromSlot0(0n, true)).toBeNull();
    expect(mezoPriceFromSlot0(0n, false)).toBeNull();
    expect(emissionsApr({ rewardRate, mezoPrice: 0n, userLp: 0n, totalStaked, pool })).toBeNull();
  });

  it("derives the MEZO price from slot0", () => {
    expect(mezoPriceFromSlot0(6156700884057131831721326345n, true)).toBe(6038609436909955n);
  });

  it("inverts the price when MEZO is token1", () => {
    const inverted = mezoPriceFromSlot0(6156700884057131831721326345n, false);
    // 1 / 0.006038...: about 165.6 MEZO per MUSD-side unit
    expect(inverted! / 10n ** 18n).toBe(165n);
  });

  it("values LP at the pool's mid price", () => {
    // The brief's 1,000 MUSD LP amount is rounded to 18 digits, so the value lands a hair under 1,000.
    const value = lpValueInMusd(1785209539358019003n, pool);
    expect(value).toBeGreaterThan(999n * 10n ** 18n + 999n * 10n ** 15n);
    expect(value).toBeLessThanOrEqual(1000n * 10n ** 18n);
  });

  it("matches mezo.org's order of magnitude: about 95.17% with no user amount", () => {
    const apr = emissionsApr({ rewardRate, mezoPrice, userLp: 0n, totalStaked, pool })!;
    expect(apr).toBeGreaterThan(951700000000000000n);
    expect(apr).toBeLessThan(951800000000000000n);
  });

  it("includes the user's own deposit in the dilution", () => {
    const apr = emissionsApr({ rewardRate, mezoPrice, userLp: 1785209539358019003n, totalStaked, pool })!;
    expect(apr).toBeGreaterThan(941900000000000000n);
    expect(apr).toBeLessThan(942000000000000000n);
  });

  it("gives about 2,991 MEZO a week on 1,000 MUSD of LP", () => {
    expect(mezoPerWeek(rewardRate, 1785209539358019003n, totalStaked) / 10n ** 18n).toBe(2991n);
  });

  it("gives no APR without a price", () => {
    expect(emissionsApr({ rewardRate, mezoPrice: null, userLp: 0n, totalStaked, pool })).toBeNull();
  });

  it("handles an empty gauge and zero user LP", () => {
    expect(mezoPerWeek(rewardRate, 0n, 0n)).toBe(0n);
    expect(emissionsApr({ rewardRate, mezoPrice, userLp: 0n, totalStaked: 0n, pool })).toBeNull();
  });

  it("treats a finished week as closed", () => {
    const state = { alive: true, rewardRate, periodFinish: 100n, totalStaked, staked: 0n, earned: 0n };
    expect(gaugeWeekOpen(state, 100n)).toBe(false);
    expect(gaugeWeekOpen(state, 99n)).toBe(true);
    expect(gaugeWeekOpen({ ...state, alive: false }, 99n)).toBe(false);
  });
});
