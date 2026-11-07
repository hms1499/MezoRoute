import { describe, expect, it } from "vitest";
import { capacityAfterRefinance, capacityCheck, leverageSteps } from "./capacity";
import { HARNESS_MARKET, ONE, trove } from "./test-fixtures";

describe("capacity", () => {
  it("refinance resets capacity to coll × price / 110%", () => {
    expect(capacityAfterRefinance(trove(ONE, 30_000n * ONE), HARNESS_MARKET.price)).toBe((100_000n * ONE * 100n) / 110n);
  });

  it("is ok within the stored capacity, refinance when only a refinance makes room, blocked otherwise", () => {
    const t = trove(2n * ONE, 30_000n * ONE, 0n, { maxBorrowingCapacity: 40_000n * ONE });
    expect(capacityCheck(t, HARNESS_MARKET.price, 9_000n * ONE, HARNESS_MARKET.borrowingRate)).toBe("ok");
    expect(capacityCheck(t, HARNESS_MARKET.price, 20_000n * ONE, HARNESS_MARKET.borrowingRate)).toBe("refinance");
    expect(capacityCheck(t, HARNESS_MARKET.price, 200_000n * ONE, HARNESS_MARKET.borrowingRate)).toBe("blocked");
  });
});

describe("leverageSteps", () => {
  it("leverageSteps adds refinance only when it makes room", () => {
    expect(leverageSteps("ok")).toEqual(["authorise", "permit", "send"]);
    expect(leverageSteps("refinance")).toEqual(["refinance", "authorise", "permit", "send"]);
  });
});
