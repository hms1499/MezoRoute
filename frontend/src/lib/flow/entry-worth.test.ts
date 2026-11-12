import { describe, expect, it } from "vitest";
import { lpValueAfterDrop } from "@/lib/exposure/exposure";
import { entryGap, entryGapLine, entryWorth, priceImpactCost } from "./entry-worth";

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
    expect(entryGapLine(worth, "200 MUSD")).toBe(
      "≈ 10 MUSD (5%) below the 200 MUSD you put in, at the BTC price: MezoRoute fee, the pool's swap fee, and the pool's BTC price.",
    );
  });

  it("starts at 1% of what was put in", () => {
    expect(entryGap({ ...worth, putIn: (19192n * E) / 100n, gap: (192n * E) / 100n })).not.toBeNull();
    expect(entryGap({ ...worth, putIn: (19189n * E) / 100n, gap: (189n * E) / 100n })).toBeNull();
  });

  it("is never a gain", () => {
    const above = entryWorth(quote, 900n * E, 180n * E);
    expect(above.gap).toBe(-10n * E);
    expect(entryGap(above)).toBeNull();
    expect(entryGapLine(above, "180 MUSD")).toBeNull();
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
