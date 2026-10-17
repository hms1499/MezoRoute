import { describe, expect, it } from "vitest";
import { BORROWING_RATE, deployerTrove, FIXTURE_PRICE, MCR, ONE } from "@/lib/dashboard/test-fixtures";
import { borrowEffect, borrowLimit, isRecoveryMode, type SystemState } from "./borrow";
import { CR_SAFETY_FLOOR } from "./constants";
import { borrowHeadroom } from "./health";

const protocol = { mcr: MCR, borrowingRate: BORROWING_RATE };

describe("borrowEffect", () => {
  it("adds the amount and the rounded-down 0.1% fee to debt and principal, as BorrowerOperations does", () => {
    expect(borrowEffect(deployerTrove, FIXTURE_PRICE, protocol, 100n * ONE)).toEqual({
      amount: 100n * ONE,
      fee: 100_000_000_000_000_000n,
      newPrincipal: 2_161_960_000_000_000_000_000n,
      newDebt: 2_162_516_504_131_786_872_189n,
      newCr: 1_798_653_960_590_980_544n,
      // TroveManager.getNominalICR: collateral × 1e20 / principal (interest is not in the NICR).
      newNicr: 2_081_444_615_071_509n,
    });
  });

  it("rounds the fee down", () => {
    expect(borrowEffect(deployerTrove, FIXTURE_PRICE, protocol, 999n).fee).toBe(0n);
    expect(borrowEffect(deployerTrove, FIXTURE_PRICE, protocol, 1_000n).fee).toBe(1n);
  });
});

describe("borrowLimit", () => {
  it("is the fee-aware headroom, capped by the executor's maxMusdIn", () => {
    const headroom = borrowHeadroom(deployerTrove, FIXTURE_PRICE, protocol);
    expect(headroom).toBe(242_200_593_184_119_916_984n);
    expect(borrowLimit(deployerTrove, FIXTURE_PRICE, protocol, 1_000_000n * ONE)).toBe(headroom);
    expect(borrowLimit(deployerTrove, FIXTURE_PRICE, protocol, 100n * ONE)).toBe(100n * ONE);
    expect(borrowLimit(null, FIXTURE_PRICE, protocol, 1_000n * ONE)).toBe(0n);
  });

  it.each([
    ["capacity-bound", deployerTrove],
    ["floor-bound", { ...deployerTrove, maxBorrowingCapacity: 10_000n * ONE }],
  ])("keeps a %s Trove at or above the floor and within capacity when borrowing exactly the limit", (_name, trove) => {
    const limit = borrowLimit(trove, FIXTURE_PRICE, protocol, 1_000_000n * ONE);
    expect(limit > 0n).toBe(true);
    const effect = borrowEffect(trove, FIXTURE_PRICE, protocol, limit);
    expect(effect.newCr! >= CR_SAFETY_FLOOR).toBe(true);
    expect(effect.newDebt <= trove.maxBorrowingCapacity).toBe(true);
  });
});

describe("isRecoveryMode", () => {
  // Testnet on 12 Oct 2026: TCR ≈ 300% against a 150% CCR.
  const testnet: SystemState = {
    coll: 15_413_774_352_354_411_406_618n,
    debt: 428_873_804_402_699_388_378_829_611n,
    ccr: 1_500_000_000_000_000_000n,
    troveCount: 242n,
  };

  it("compares the system's collateral ratio with the CCR", () => {
    expect(isRecoveryMode(testnet, FIXTURE_PRICE)).toBe(false);
    expect(isRecoveryMode(testnet, 40_000n * ONE)).toBe(true);
  });

  it("is never on without system debt", () => {
    expect(isRecoveryMode({ ...testnet, debt: 0n }, 1n)).toBe(false);
  });
});
