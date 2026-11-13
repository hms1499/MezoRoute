import { describe, expect, it } from "vitest";
import { MIN_NET_DEBT } from "@/lib/trove/constants";
import { minOpenBtc, openMaxCr, quoteOpen } from "./quote-open";
import { LEVERAGE_CR_FLOOR } from "@/lib/trove/constants";
import { HARNESS_MARKET, HARNESS_POOL, MAINNET_MARKET, MAINNET_POOL, ONE } from "./test-fixtures";

describe("quoteOpen", () => {
  it("quoteOpen keeps net debt at 1,800 on mainnet sizes", () => {
    const q = quoteOpen((45n * ONE) / 1000n, MAINNET_POOL, MAINNET_MARKET, 2n * ONE, 100n, 10n, 125n * 10n ** 14n)!;
    expect(q.btcToFlash).toBe(125n * 10n ** 14n); // the cap binds before the 200% target
    expect(q.debtAmount + (q.debtAmount * MAINNET_MARKET.borrowingRate) / ONE >= MIN_NET_DEBT).toBe(true);
    expect(q.musdSurplus > 0n).toBe(true);
    expect(q.crAfter >= 2n * ONE).toBe(true);
  });

  it("borrows exactly what the pool needs once that is above the minimum", () => {
    const q = quoteOpen(ONE, HARNESS_POOL, HARNESS_MARKET, 2n * ONE, 100n, 10n, 12n * ONE)!;
    expect(q.crAfter >= 2n * ONE).toBe(true);
    expect(q.debtAmount).toBe(q.maxMusdToPool + (q.maxMusdToPool * 10n) / 10_000n);
    expect(q.after.coll).toBe(ONE + q.btcToFlash);
  });

  it("quoteOpen returns null when 200% is unreachable", () => {
    expect(quoteOpen(ONE / 100n, HARNESS_POOL, HARNESS_MARKET, 2n * ONE, 100n, 10n, 12n * ONE)).toBeNull();
  });
});

describe("openMaxCr", () => {
  it("is the highest CR an Open reaches with this BTC, and a target at it still quotes", () => {
    const max = openMaxCr(ONE / 10n, HARNESS_POOL, HARNESS_MARKET, 100n, 10n, 12n * ONE);
    expect(quoteOpen(ONE / 10n, HARNESS_POOL, HARNESS_MARKET, max, 100n, 10n, 12n * ONE)?.crAfter).toBe(max);
    expect(quoteOpen(ONE / 10n, HARNESS_POOL, HARNESS_MARKET, max + 1n, 100n, 10n, 12n * ONE)).toBeNull();
  });

  it("rises with the BTC brought", () => {
    const small = openMaxCr(ONE / 100n, HARNESS_POOL, HARNESS_MARKET, 100n, 10n, 12n * ONE);
    expect(small < 2n * ONE).toBe(true); // why quoteOpen returns null above
    expect(openMaxCr(ONE / 10n, HARNESS_POOL, HARNESS_MARKET, 100n, 10n, 12n * ONE) > small).toBe(true);
  });
});

describe("minOpenBtc", () => {
  const STEP = 10_000_000_000n; // 8 decimals
  it("is the smallest BTC of the user's own that opens at the floor", () => {
    for (const [pool, market, flash] of [
      [HARNESS_POOL, HARNESS_MARKET, 12n * ONE],
      [MAINNET_POOL, MAINNET_MARKET, 125n * 10n ** 14n],
    ] as const) {
      const min = minOpenBtc(pool, market, LEVERAGE_CR_FLOOR, 100n, 10n, flash);
      expect(min).not.toBeNull();
      expect(min! % STEP).toBe(0n);
      expect(quoteOpen(min!, pool, market, LEVERAGE_CR_FLOOR, 100n, 10n, flash)).not.toBeNull();
      expect(quoteOpen(min! - STEP, pool, market, LEVERAGE_CR_FLOOR, 100n, 10n, flash)).toBeNull();
    }
  });

  // The debt never goes below the 2,000 MUSD minimum, so 100 BTC at 100,000 MUSD tops out near 500,000%.
  it("is null when no amount up to 100 BTC reaches the target", () => {
    expect(minOpenBtc(HARNESS_POOL, HARNESS_MARKET, 100_000n * ONE, 100n, 10n, 12n * ONE)).toBeNull();
  });
});
