import { describe, expect, it } from "vitest";
import { MIN_NET_DEBT } from "@/lib/trove/constants";
import { quoteOpen } from "./quote-open";
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
