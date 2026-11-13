import { describe, expect, it } from "vitest";
import type { TroveState } from "@/lib/leverage/trove-math";
import { troveHealth } from "./health";
import { interestDrift, liquidationDrop, liquidationRisk, multiplyView, redemptionRisk, riskLines, riskLinesText } from "./risk";

const MCR = 1_100_000_000_000_000_000n;
/** A percent with up to three decimals as a 1e18 ratio (157.1 → 1.571e18), exact. */
const pct = (p: number) => (BigInt(Math.round(p * 1000)) * 10n ** 18n) / 100_000n;
// The testnet QA wallet 0xe618…0D56 on 13 Nov 2026.
const LIVE: TroveState = {
  coll: 99_499_760_615_756_376n,
  principal: 2_419_006_790_000_000_000_000n,
  interest: 9_821_768_641_358_278_199n,
  debt: 2_428_828_558_641_358_278_199n,
  maxBorrowingCapacity: 0n,
  interestRateBps: 100n,
};
const PRICE = 69_079_566_890_000_000_000_000n;

describe("liquidationRisk", () => {
  it("bands at MCR 110%", () => {
    expect(liquidationRisk(null, MCR)).toBeNull();
    expect(liquidationRisk(pct(109.9), MCR)).toBe("liquidatable");
    expect(liquidationRisk(pct(150.7), MCR)).toBe("high");
    expect(liquidationRisk(pct(157.1), MCR)).toBe("high");
    expect(liquidationRisk(pct(157.2), MCR)).toBe("medium");
    expect(liquidationRisk(pct(203.7), MCR)).toBe("medium");
    expect(liquidationRisk(pct(203.8), MCR)).toBe("low");
    expect(liquidationRisk(2_829_924_057_233_575_620n, MCR)).toBe("low"); // the live QA Trove
  });

  it("is high or liquidatable exactly when the Dashboard's at-risk rule or Liquity's line says so", () => {
    for (let p = 100_000; p <= 220_000; p += 50) {
      const cr = pct(p / 1000);
      const risky = troveHealth(cr, MCR) !== "healthy" || cr * 73n < MCR * 100n;
      expect(["high", "liquidatable"].includes(liquidationRisk(cr, MCR)!)).toBe(risky);
    }
  });
});

describe("riskLines", () => {
  it("rounds the lines up", () => {
    const { high, medium } = riskLines(MCR);
    expect(high).toBe(1_571_428_571_428_571_429n);
    expect(medium).toBe(2_037_037_037_037_037_038n);
  });
});

describe("riskLinesText", () => {
  it("names each band with its whole-percent edges (QA: the bare 'High below' read as unfinished)", () => {
    expect(riskLinesText(MCR)).toBe("Low from 204% · Medium 158–204% · High below 158%");
  });
});

describe("redemptionRisk", () => {
  it("reads the share of all debt ahead", () => {
    expect(redemptionRisk(0n, 0n)).toBeNull();
    expect(redemptionRisk(428_070_189_937_069_797_584_715_102n, 429_526_842_219_368_806_213_227_836n)).toBe("low"); // live, 99.7%
    expect(redemptionRisk(61n, 100n)).toBe("low");
    expect(redemptionRisk(60n, 100n)).toBe("medium");
    expect(redemptionRisk(6n, 100n)).toBe("medium");
    expect(redemptionRisk(5n, 100n)).toBe("high");
  });
});

describe("liquidationDrop", () => {
  it("floors and never goes negative", () => {
    expect(liquidationDrop(26_851_435_601_166_791_054_040n, PRICE)).toBe(61);
    expect(liquidationDrop(PRICE + 1n, PRICE)).toBe(0);
  });
});

describe("interestDrift", () => {
  it("is the liquidation price's rise in a year of interest", () => {
    expect(interestDrift(LIVE, MCR)).toBe(267_428_529_730_415_205_969n);
    expect(interestDrift({ ...LIVE, interestRateBps: 0n }, MCR)).toBeNull();
    expect(interestDrift({ ...LIVE, coll: 0n }, MCR)).toBeNull();
  });
});

describe("multiplyView", () => {
  it("gives net value and leverage", () => {
    const v = multiplyView(LIVE, PRICE);
    expect(v.netValue).toBe(4_444_571_810_353_771_885_636n);
    expect(v.netBtc).toBe(64_339_891_091_546_070n);
    expect(v.leverage! / 10n ** 16n).toBe(154n); // 1.54×
    expect(multiplyView({ ...LIVE, debt: LIVE.debt * 100n }, PRICE).leverage).toBeNull();
  });
});
