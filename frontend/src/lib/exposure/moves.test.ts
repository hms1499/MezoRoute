import { describe, expect, it } from "vitest";
import { atRiskTrove, deployerTrove, lpShare, MCR, snapshotWith, spPosition } from "@/lib/dashboard/test-fixtures";
import { WAD } from "@/lib/math";
import { collateralRatio, liquidationPrice } from "@/lib/trove/health";
import { exposure, lpValueAfterDrop } from "./exposure";
import { lpMoveFactor, mcrCrossing, MOVES, moveScenarios } from "./moves";

const full = snapshotWith({ trove: deployerTrove, lp: lpShare, sp: spPosition });

describe("lpMoveFactor", () => {
  it("is 1 at no move and above 1 when BTC rises", () => {
    expect(lpMoveFactor(0)).toBe(WAD);
    expect(lpMoveFactor(30)).toBeGreaterThan(WAD);
  });

  it("matches lpValueAfterDrop at the 10/20/30% drops", () => {
    const value = exposure(full).lpValue;
    for (const drop of [10, 20, 30] as const) {
      expect((value * lpMoveFactor(-drop)) / WAD).toBe(lpValueAfterDrop(value, drop));
    }
  });
});

describe("moveScenarios", () => {
  const current = exposure(full);
  const rows = moveScenarios(full, current);

  it("covers −30% to +30% in 5% steps", () => {
    expect(MOVES).toEqual([-30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30]);
    expect(rows).toHaveLength(13);
  });

  it("equals today's values at no move", () => {
    const today = rows.find((row) => row.move === 0)!;
    expect(today.price).toBe(full.price);
    expect(today.lpValue).toBe(current.lpValue);
    expect(today.spValue).toBe(current.spValue);
    expect(today.collateralRatio).toBe(collateralRatio(deployerTrove, full.price));
  });

  it("keeps a Stability Pool deposit without BTC gain flat", () => {
    const snapshot = snapshotWith({ sp: { deposit: 50n * WAD, btcGain: 0n } });
    const values = moveScenarios(snapshot, exposure(snapshot)).map((row) => row.spValue);
    expect(new Set(values)).toEqual(new Set([50n * WAD]));
  });

  it("has no collateral ratio without a Trove", () => {
    const snapshot = snapshotWith({ lp: lpShare });
    expect(moveScenarios(snapshot, exposure(snapshot)).every((row) => row.collateralRatio === null)).toBe(true);
  });
});

describe("mcrCrossing", () => {
  it("is null when the liquidation price lies beyond a 30% move", () => {
    expect(mcrCrossing(full)).toBeNull(); // CR ≈ 188.6%: liquidated only after a ≈ 41.7% drop
  });

  it("gives the liquidation price and its move, rounded toward zero to 0.1%", () => {
    const snapshot = snapshotWith({ trove: atRiskTrove });
    expect(mcrCrossing(snapshot)).toEqual({ price: liquidationPrice(atRiskTrove, MCR), move: -27 });
  });

  it("is null without a Trove", () => {
    expect(mcrCrossing(snapshotWith({ lp: lpShare }))).toBeNull();
  });
});
