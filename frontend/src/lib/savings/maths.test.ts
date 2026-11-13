import { describe, expect, it } from "vitest";
import { formatPercent, formatToken } from "@/lib/format";
import { savingsReturn, savingsWeek } from "./maths";

// Mainnet, 13 Nov 2026: the vault gauge paid 0.8056 MEZO/s over 151,024 staked sMUSD; its week ends 19 Nov 00:00 UTC.
const gauge = { alive: true, rewardRate: 805_620_943_026_785_549n, periodFinish: 1_795_046_400n, totalStaked: 151_023_584_600_783_358_698_787n };
const state = { totalSupply: 1_323_505_568_564_574_227_223_293n, yieldIndex: 218_681_915_228_140_081n, gauge };
const ONE_K = 1_000n * 10n ** 18n;
const NOW = 1_794_534_077n;

describe("savingsWeek", () => {
  it("gives this week's MEZO for the amount, diluted by it", () => {
    const week = savingsWeek({ state, amount: ONE_K, now: NOW, mezoPrice: null });
    expect(week.availability).toBe("open");
    expect(formatToken(week.mezoPerWeek!, 18, 0)).toBe("3,205");
    expect(week.apr).toBeNull();
  });

  it("prices the APR on the staked MUSD when MEZO has a price", () => {
    const week = savingsWeek({ state, amount: ONE_K, now: NOW, mezoPrice: 6_000_000_000_000_000n });
    // 0.8056 × 31,536,000 × 0.006 / 152,023.58 ≈ 100.3%
    expect(formatPercent(week.apr!, 0)).toBe("100%");
  });

  it("shows no rate between weeks or on a dead gauge", () => {
    expect(savingsWeek({ state, amount: ONE_K, now: gauge.periodFinish + 60n, mezoPrice: null })).toEqual({ availability: "between-weeks", mezoPerWeek: null, apr: null });
    expect(savingsWeek({ state: { ...state, gauge: { ...gauge, alive: false } }, amount: ONE_K, now: NOW, mezoPrice: null }).availability).toBe("unavailable");
    expect(savingsWeek({ state: { ...state, gauge: null }, amount: ONE_K, now: NOW, mezoPrice: null })).toEqual({ availability: "unavailable", mezoPerWeek: null, apr: null });
  });
});

describe("savingsReturn", () => {
  it("is the index's growth: MUSD per sMUSD over the window", () => {
    const ret = savingsReturn(214_330_524_003_397_543n, 218_681_915_228_140_081n);
    expect(ret).toBe(4_351_391_224_742_538n);
    expect(formatPercent(ret, 2)).toBe("0.43%"); // formatPercent floors: 0.4351% shows as 0.43%
  });
});
