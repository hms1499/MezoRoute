import { describe, expect, it } from "vitest";
import { cr, liquidationPriceOf, nominalCr, troveAfter } from "./trove-math";
import { HARNESS_MARKET, ONE, trove } from "./test-fixtures";

describe("troveAfter", () => {
  it("repays interest before principal, as MUSD does", () => {
    const after = troveAfter(trove(ONE, 40_000n * ONE, 100n * ONE), { collDelta: 0n, debtDelta: -150n * ONE, feeOnIncrease: 0n });
    expect(after.interest).toBe(0n);
    expect(after.principal).toBe(39_950n * ONE);
    expect(after.debt).toBe(39_950n * ONE);
  });

  it("adds a debt increase and its fee to principal and collateral changes to coll", () => {
    const after = troveAfter(trove(ONE, 30_000n * ONE), { collDelta: ONE / 5n, debtDelta: 1_000n * ONE, feeOnIncrease: ONE });
    expect(after.coll).toBe((6n * ONE) / 5n);
    expect(after.principal).toBe(31_001n * ONE);
  });
});

describe("ratios", () => {
  it("nominalCr uses principal only (TroveManager.getNominalICR)", () => {
    expect(nominalCr(trove(ONE, 40_000n * ONE, 1_000n * ONE))).toBe((ONE * 10n ** 20n) / (40_000n * ONE));
  });

  it("cr and the liquidation price use the whole debt", () => {
    const t = trove(ONE, 40_000n * ONE, 4_000n * ONE);
    expect(cr(t, HARNESS_MARKET.price)).toBe((100_000n * ONE * ONE) / (44_000n * ONE));
    expect(liquidationPriceOf(t, HARNESS_MARKET.mcr)).toBe(48_400n * ONE);
    expect(cr(trove(ONE, 0n), HARNESS_MARKET.price)).toBeNull();
  });
});
