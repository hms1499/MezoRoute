import { describe, expect, it } from "vitest";
import { LEVERAGE_CR_FLOOR } from "@/lib/trove/constants";
import { exactInput } from "./pool-math";
import { capacityCheck } from "./capacity";
import { leverageMax, leverageQuoteAt, quoteLeverage } from "./quote-leverage";
import { HARNESS_MARKET, HARNESS_POOL, ONE, TESTNET_MARKET, TESTNET_POOL, trove } from "./test-fixtures";

const t = trove(ONE, 30_000n * ONE); // CR 333%

describe("quoteLeverage", () => {
  const q = quoteLeverage(t, HARNESS_POOL, HARNESS_MARKET, (25n * ONE) / 10n, 100n, 10n)!;

  it("quoteLeverage lands at or above the target CR with the most BTC", () => {
    expect(q.crAfter >= (25n * ONE) / 10n).toBe(true);
    const more = quoteLeverage(t, HARNESS_POOL, HARNESS_MARKET, (24n * ONE) / 10n, 100n, 10n)!;
    expect(more.btcToAdd > q.btcToAdd).toBe(true);
  });

  it("borrows the pool's MUSD plus slippage plus the fee, and the surplus is the rest", () => {
    expect(q.musdToPool).toBe(exactInput(HARNESS_POOL.reserveMusd, HARNESS_POOL.reserveBtc, q.btcToAdd, 30n));
    expect(q.maxMusdToPool >= (q.musdToPool * 10_100n) / 10_000n).toBe(true);
    expect(q.debtIncrease).toBe(q.maxMusdToPool + (q.maxMusdToPool * 10n) / 10_000n);
    expect(q.fee).toBe((q.musdToPool * 10n) / 10_000n);
    expect(q.musdSurplus).toBe(q.debtIncrease - q.musdToPool - q.fee);
    expect(q.borrowingFee).toBe(q.debtIncrease / 1000n);
    expect(q.after.coll).toBe(ONE + q.btcToAdd);
  });

  it("returns null when the target is not below today's CR", () => {
    expect(quoteLeverage(t, HARNESS_POOL, HARNESS_MARKET, 4n * ONE, 100n, 10n)).toBeNull();
  });
});

describe("leverageMax", () => {
  it("stops at the 200% floor when nothing else binds", () => {
    const m = leverageMax(t, HARNESS_POOL, HARNESS_MARKET, 10n, { maxBtcFlash: 12n * ONE }, 1_000n, 100n);
    expect(m.limitedBy).toBe("floor");
    const at = quoteLeverage(t, HARNESS_POOL, HARNESS_MARKET, LEVERAGE_CR_FLOOR, 100n, 10n)!;
    expect(m.btc).toBe(at.btcToAdd);
  });

  it("stops at the cap", () => {
    expect(leverageMax(t, HARNESS_POOL, HARNESS_MARKET, 10n, { maxBtcFlash: ONE / 100n }, 1_000n, 100n)).toEqual({
      btc: ONE / 100n,
      limitedBy: "cap",
    });
  });

  it("leverageMax caps at refinance capacity", () => {
    // CR 2,000%: reaching 200% would need ≈ 0.86 BTC of new debt, but a refinance allows only
    // 1 BTC × 100,000 / 1.1 ≈ 90,909 MUSD of total debt (≈ 0.84 BTC).
    // A deep pool keeps price impact out of the way, so capacity is what binds.
    const deep = { reserveMusd: 100_000_000n * ONE, reserveBtc: 1_000n * ONE, feeBps: 30n };
    const highCr = trove(ONE, 5_000n * ONE, 0n, { maxBorrowingCapacity: 6_000n * ONE });
    const m = leverageMax(highCr, deep, HARNESS_MARKET, 10n, { maxBtcFlash: 12n * ONE }, 1_000n, 100n);
    expect(m.limitedBy).toBe("capacity");
    const q = quoteLeverage(highCr, deep, HARNESS_MARKET, LEVERAGE_CR_FLOOR, 100n, 10n)!;
    expect(m.btc < q.btcToAdd).toBe(true);
    const atMax = leverageQuoteAt(highCr, deep, HARNESS_MARKET, m.btc, 100n, 10n);
    expect(capacityCheck(highCr, HARNESS_MARKET.price, atMax.debtIncrease, HARNESS_MARKET.borrowingRate)).toBe("refinance");
  });

  it("leverageMax caps at the oracle bound on testnet", () => {
    const big = trove(100n * ONE, 1_000_000n * ONE, 0n, { maxBorrowingCapacity: 10n ** 30n });
    // With a cap above ≈ 17 BTC, the pool's 3.7% gap plus impact reaches the 500 bps bound first.
    const m = leverageMax(big, TESTNET_POOL, TESTNET_MARKET, 10n, { maxBtcFlash: 100n * ONE }, 500n, 100n);
    expect(m.limitedBy).toBe("oracle");
  });
});
