import { describe, expect, it } from "vitest";
import { lpValueAfterDrop } from "@/lib/exposure/exposure";
import { ENTRY_GAP_CAUSE, entryGap, entryGapLine, entryGapRow, entryWorth, priceImpactCost } from "./entry-worth";

const E = 10n ** 18n;
// A tenth of a pool that holds 1,000 MUSD and 1 BTC after the entry.
const quote = { liquidity: 10n * E, after: { reserveMusd: 1000n * E, reserveBtc: 1n * E, totalSupply: 100n * E } } as never;

describe("entryWorth", () => {
  it("values the share at the oracle price", () => {
    const w = entryWorth(quote, 900n * E, 200n * E);
    expect(w).toEqual({
      value: 190n * E,
      btcShare: E / 10n,
      putIn: 200n * E,
      gap: 10n * E,
      valueAfterDrop: lpValueAfterDrop(190n * E, 30),
      lossAfterDrop: 200n * E - lpValueAfterDrop(190n * E, 30),
    });
  });
});

describe("entryGap", () => {
  const worth = entryWorth(quote, 900n * E, 200n * E);

  it("says the gap against what was put in", () => {
    expect(entryGapLine(worth)).toBe("≈ 10 MUSD (5%) below what you put in");
    expect(entryGapRow(worth)).toEqual({ label: "Below what you put in", value: "≈ 10 MUSD (5%)", sub: `at the BTC price: ${ENTRY_GAP_CAUSE}`, tone: "warning" });
  });

  it("starts at 1% of what was put in", () => {
    expect(entryGap({ ...worth, putIn: (19192n * E) / 100n, gap: (192n * E) / 100n })).not.toBeNull();
    expect(entryGap({ ...worth, putIn: (19189n * E) / 100n, gap: (189n * E) / 100n })).toBeNull();
  });

  it("rounds a cost up, never down", () => {
    // 35 below 225 put in is 15.56%: "15.5%" would understate it.
    expect(entryGap({ ...worth, putIn: 225n * E, gap: 35n * E })).toEqual({ amount: "35", percent: "15.6%" });
    // One decimal: a whole-percent ceiling called 1.16% "2%".
    expect(entryGap({ ...worth, putIn: 1000n * E, gap: (1164n * E) / 100n })).toEqual({ amount: "11.64", percent: "1.2%" });
    expect(entryGap({ ...worth, putIn: 1000n * E, gap: (29_941n * E) / 1000n })).toEqual({ amount: "29.95", percent: "3%" });
  });

  it("is never a gain", () => {
    const above = entryWorth(quote, 900n * E, 180n * E);
    expect(above.gap).toBe(-10n * E);
    expect(entryGap(above)).toBeNull();
    expect(entryGapLine(above)).toBeNull();
    expect(entryGapRow(above)).toBeNull();
  });

  it("survives nothing put in", () => {
    expect(entryGap(entryWorth(quote, 900n * E, 0n))).toBeNull();
  });
});

describe("priceImpactCost", () => {
  it("prices the impact in the token that is swapped", () => {
    expect(priceImpactCost({ musdToSwap: 500n * E, priceImpact: E / 50n } as never)).toEqual({ amount: 10n * E, unit: "MUSD" });
    expect(priceImpactCost({ btcIn: E, btcToSwap: E / 2n, priceImpact: E / 50n } as never)).toEqual({ amount: E / 100n, unit: "BTC" });
  });
});
