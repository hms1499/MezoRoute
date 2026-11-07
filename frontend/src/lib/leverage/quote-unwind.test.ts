import { describe, expect, it } from "vitest";
import { exactInput } from "./pool-math";
import { quoteUnwind, unwindMax } from "./quote-unwind";
import { HARNESS_MARKET, HARNESS_POOL, ONE, trove } from "./test-fixtures";

const t = trove(ONE, 40_000n * ONE); // CR 250%

describe("quoteUnwind", () => {
  it("lands at or above the target CR with the smallest repayment", () => {
    const q = quoteUnwind(t, HARNESS_POOL, HARNESS_MARKET, 3n * ONE, 100n)!;
    expect(q.crAfter >= 3n * ONE).toBe(true);
    const smaller = quoteUnwind({ ...t }, HARNESS_POOL, HARNESS_MARKET, 3n * ONE, 100n)!;
    expect(smaller.debtToRepay).toBe(q.debtToRepay);
    expect(q.btcToPool).toBe(exactInput(HARNESS_POOL.reserveBtc, HARNESS_POOL.reserveMusd, q.debtToRepay, 30n));
    expect(q.collWithdrawal).toBe(q.maxBtcToPool);
    expect(q.btcToWallet).toBe(q.collWithdrawal - q.btcToPool);
    expect(q.after.coll).toBe(ONE - q.collWithdrawal);
  });

  it("returns null when the target is at or below the current CR", () => {
    expect(quoteUnwind(t, HARNESS_POOL, HARNESS_MARKET, (25n * ONE) / 10n, 100n)).toBeNull();
    expect(quoteUnwind(t, HARNESS_POOL, HARNESS_MARKET, 2n * ONE, 100n)).toBeNull();
  });

  it("returns null when the target needs more than the maximum repayment", () => {
    expect(quoteUnwind(t, HARNESS_POOL, HARNESS_MARKET, 100n * ONE, 100n)).toBeNull();
  });
});

describe("unwindMax", () => {
  it("unwindMax keeps net debt at 1,800", () => {
    expect(unwindMax(t)).toBe(40_000n * ONE - 2_000n * ONE);
    expect(unwindMax(trove(ONE, 1_999n * ONE))).toBe(0n);
  });
});
