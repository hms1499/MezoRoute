import { describe, expect, it } from "vitest";
import type { MainnetReferenceData } from "./load";
import { landingLive } from "./landing";

const ONE = 10n ** 18n;
const reference = {
  reserveMusd: 101_720n * ONE,
  reserveBtc: 1_250_000_000_000_000_000n, // 1.25 BTC
  lpSupply: 356n * ONE,
  feeBps: 30n,
  price: 80_000n * ONE,
  musdSupply: 29_871_966n * ONE,
  spDeposits: 14_172_031n * ONE,
};

describe("landingLive", () => {
  it("shows a skeleton while the first read runs", () => {
    expect(landingLive(undefined, null)).toEqual({ kind: "loading" });
  });

  it("hides the card when the read fails, so the page stays complete", () => {
    expect(landingLive(undefined, new Error("fetch failed"))).toEqual({ kind: "hidden" });
  });

  it("formats the pool value, Stability Pool deposits, and their share of supply", () => {
    const live = landingLive({ reference, backtests: null }, null);
    expect(live).toEqual({
      kind: "data",
      poolValue: "201,720 MUSD", // 101,720 + 1.25 × 80,000
      lpFees: null,
      spDeposits: "14,172,031 MUSD",
      spShare: "47.4%",
    });
  });

  it("adds the 30-day LP line when the history loaded", () => {
    const backtests = {
      lp: { liquidity: 0n, feesMusd: 0n, feesBtc: 0n, feesValue: 0n, valueNow: 0n, feeReturn: 1_300_000_000_000_000n, feeRate: 16_000_000_000_000_000n },
      sp: { depositNow: 0n, btcGain: 0n, valueNow: 0n, gainReturn: 0n, lossReturn: 0n, liquidated: false },
      seconds: 2_592_000n,
      pastTime: 0n,
      pastBlock: 0n,
      headBlock: 0n,
    } satisfies NonNullable<MainnetReferenceData["backtests"]>;
    const live = landingLive({ reference, backtests }, null);
    expect(live.kind === "data" && live.lpFees).toBe("Fees 0.13% (≈1.6% a year, fees only)");
  });

  it("keeps showing loaded data while a refetch fails", () => {
    expect(landingLive({ reference, backtests: null }, new Error("fetch failed")).kind).toBe("data");
  });
});
