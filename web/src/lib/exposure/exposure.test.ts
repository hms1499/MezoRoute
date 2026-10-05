import { describe, expect, it } from "vitest";
import { atRiskTrove, deployerTrove, lpShare, snapshotWith, spPosition } from "@/lib/dashboard/test-fixtures";
import { drawdownScenarios, exposure } from "./exposure";

const full = snapshotWith({ trove: deployerTrove, lp: lpShare, sp: spPosition });

describe("exposure", () => {
  it("adds Trove, LP, and Stability Pool BTC, and values the LP and SP positions", () => {
    expect(exposure(full)).toEqual({
      troveBtc: 45_000_000_000_000_000n,
      lpBtc: 600_000_000_000_000n,
      lpMusd: 52_000_000_000_000_000_000n,
      spBtcGain: 20_000_000_000_000n,
      spDeposit: 50_000_000_000_000_000_000n,
      totalBtc: 45_620_000_000_000_000n,
      lpValue: 103_861_585_000_000_000_000n,
      spValue: 51_728_719_500_000_000_000n,
    });
  });

  it("handles no Trove", () => {
    const current = exposure(snapshotWith({ lp: lpShare, sp: spPosition }));
    expect(current.troveBtc).toBe(0n);
    expect(current.totalBtc).toBe(620_000_000_000_000n);
  });

  it("handles no LP, and an empty pool without dividing by zero", () => {
    expect(exposure(snapshotWith({ trove: deployerTrove })).lpValue).toBe(0n);
    const emptyPool = exposure(snapshotWith({ lp: { ...lpShare, totalSupply: 0n } }));
    expect(emptyPool.lpBtc).toBe(0n);
    expect(emptyPool.lpMusd).toBe(0n);
  });

  it("handles no Stability Pool deposit", () => {
    const current = exposure(snapshotWith({ trove: deployerTrove }));
    expect(current.spValue).toBe(0n);
    expect(current.totalBtc).toBe(45_000_000_000_000_000n);
  });
});

describe("drawdownScenarios", () => {
  it("lowers the price, the collateral ratio, and both position values for each drawdown", () => {
    const snapshot = snapshotWith({ trove: atRiskTrove, lp: lpShare, sp: spPosition });
    expect(drawdownScenarios(snapshot, exposure(snapshot))).toEqual([
      {
        dropPercent: 10,
        price: 77_792_377_500_000_000_000_000n,
        collateralRatio: 1_357_885_560_161_832_621n,
        liquidatable: false,
        lpValue: 98_531_750_998_553_773_228n,
        spValue: 51_555_847_550_000_000_000n,
      },
      {
        dropPercent: 20,
        price: 69_148_780_000_000_000_000_000n,
        collateralRatio: 1_207_009_386_810_517_885n,
        liquidatable: false,
        lpValue: 92_896_625_724_348_997_955n,
        spValue: 51_382_975_600_000_000_000n,
      },
      {
        dropPercent: 30,
        price: 60_505_182_500_000_000_000_000n,
        collateralRatio: 1_056_133_213_459_203_149n,
        liquidatable: true,
        lpValue: 86_896_836_461_971_142_821n,
        spValue: 51_210_103_650_000_000_000n,
      },
    ]);
  });

  it("has no collateral ratio without a Trove", () => {
    const snapshot = snapshotWith({ lp: lpShare });
    for (const scenario of drawdownScenarios(snapshot, exposure(snapshot))) {
      expect(scenario.collateralRatio).toBeNull();
      expect(scenario.liquidatable).toBe(false);
    }
  });

  it("has no collateral ratio for a Trove with zero debt", () => {
    const trove = { ...deployerTrove, principal: 0n, interest: 0n, debt: 0n };
    const snapshot = snapshotWith({ trove });
    for (const scenario of drawdownScenarios(snapshot, exposure(snapshot))) {
      expect(scenario.collateralRatio).toBeNull();
      expect(scenario.liquidatable).toBe(false);
    }
  });

  it("keeps empty positions at zero", () => {
    const snapshot = snapshotWith({ trove: deployerTrove });
    for (const scenario of drawdownScenarios(snapshot, exposure(snapshot))) {
      expect(scenario.lpValue).toBe(0n);
      expect(scenario.spValue).toBe(0n);
    }
  });
});
