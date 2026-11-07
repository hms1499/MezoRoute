import { describe, expect, it } from "vitest";
import { exactInput } from "./pool-math";
import { quoteClose } from "./quote-close";
import { HARNESS_MARKET, HARNESS_POOL, ONE, trove } from "./test-fixtures";

describe("quoteClose", () => {
  const t = trove(ONE, 40_000n * ONE, 0n, { interestRateBps: 500n });
  const q = quoteClose(t, HARNESS_POOL, HARNESS_MARKET, 100n);

  it("flashes the debt less the 200 MUSD gas compensation", () => {
    expect(q.musdNeeded).toBe(39_800n * ONE);
    expect(q.btcToPool).toBe(exactInput(HARNESS_POOL.reserveBtc, HARNESS_POOL.reserveMusd, 39_800n * ONE, 30n));
    expect(q.btcToWallet).toBe(ONE - q.btcToPool);
    expect(q.collReturned).toBe(ONE);
  });

  it("quoteClose covers 300 s of interest", () => {
    // 40,000 MUSD at 5% a year accrues ≈ 0.019 MUSD in 300 s.
    const later = exactInput(HARNESS_POOL.reserveBtc, HARNESS_POOL.reserveMusd, 39_800n * ONE + 19n * 10n ** 15n, 30n);
    expect(q.maxBtcToPool >= later).toBe(true);
    expect(q.maxBtcToPool >= (q.btcToPool * 10_100n) / 10_000n).toBe(true);
  });

  it("costs the seller's shortfall below the oracle", () => {
    expect(q.costBps > 0n).toBe(true);
  });
});
