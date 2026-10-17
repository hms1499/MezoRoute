import { describe, expect, it } from "vitest";
import { BORROWING_RATE, deployerTrove, FIXTURE_PRICE, MCR, ONE } from "@/lib/dashboard/test-fixtures";
import { borrowHeadroom, collateralRatio, liquidationPrice, troveHealth } from "./health";

const protocol = { mcr: MCR, borrowingRate: BORROWING_RATE };

describe("collateralRatio", () => {
  it("is collateral × price / debt, rounded down", () => {
    expect(collateralRatio(deployerTrove, FIXTURE_PRICE)).toBe(1_885_952_166_891_434_196n);
  });

  it("is null without debt", () => {
    expect(collateralRatio({ ...deployerTrove, principal: 0n, interest: 0n, debt: 0n }, FIXTURE_PRICE)).toBeNull();
  });
});

describe("liquidationPrice", () => {
  it("is debt × MCR / collateral, rounded up", () => {
    expect(liquidationPrice(deployerTrove, MCR)).toBe(50_414_625_656_554_790_209_065n);
  });

  it("is null without collateral", () => {
    expect(liquidationPrice({ ...deployerTrove, collateral: 0n }, MCR)).toBeNull();
  });
});

describe("troveHealth", () => {
  it.each([
    [null, "healthy"],
    [1_885_952_166_891_434_196n, "healthy"],
    // 110% / 0.7 = 157.142857…%: just above survives a 30% drop, just below does not.
    [1_571_428_571_428_571_429n, "healthy"],
    [1_571_428_571_428_571_428n, "at-risk"],
    [MCR, "at-risk"],
    [MCR - 1n, "liquidatable"],
  ] as const)("CR %s is %s", (cr, expected) => {
    expect(troveHealth(cr, MCR)).toBe(expected);
  });
});

describe("borrowHeadroom", () => {
  it("is limited by the Trove's borrowing capacity, net of the borrowing fee", () => {
    expect(borrowHeadroom(deployerTrove, FIXTURE_PRICE, protocol)).toBe(242_200_593_184_119_916_984n);
  });

  it("is the whole gap to the capacity without a borrowing fee", () => {
    expect(borrowHeadroom(deployerTrove, FIXTURE_PRICE, { mcr: MCR, borrowingRate: 0n })).toBe(242_442_793_777_304_036_901n);
  });

  it("is limited by the 160% floor when the capacity is higher", () => {
    const trove = { ...deployerTrove, maxBorrowingCapacity: 10_000n * ONE };
    expect(borrowHeadroom(trove, FIXTURE_PRICE, protocol)).toBe(368_227_065_677_535_592_218n);
  });

  it("is zero when the debt already reaches the limit", () => {
    expect(borrowHeadroom(deployerTrove, 50_000n * ONE, protocol)).toBe(0n);
  });
});
