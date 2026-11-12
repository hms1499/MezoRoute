import { describe, expect, it } from "vitest";
import { entryGapLine, entryWorth } from "@/lib/flow/entry-worth";
import { lpDetailsRows, lpExposureRow, lpReceive, priceImpactRow } from "./entry-rows";
import { formatToken } from "@/lib/format";
import { btc, btcFine, lpShort, musdShort } from "./units";

const E = 10n ** 18n;
const quote = { liquidity: 10n * E, after: { reserveMusd: 1000n * E, reserveBtc: 1n * E, totalSupply: 100n * E } } as never;
// Worth 190 MUSD at 900 MUSD per BTC, for 200 MUSD put in.
const w = entryWorth(quote, 900n * E, 200n * E);

describe("lpExposureRow", () => {
  it("puts the loss against what was put in under the exposure", () => {
    expect(lpExposureRow({ exposureChange: E / 10n, worth: w, fromBtc: false })).toEqual({
      label: "BTC exposure",
      value: `+${btc(E / 10n)}`,
      sub: `If BTC −30%: ≈ ${formatToken(w.valueAfterDrop, 18, 2)} MUSD (−${formatToken(w.lossAfterDrop, 18, 2, "up")})`,
      tone: "btc",
    });
  });

  it("gives a BTC entry no MUSD loss", () => {
    expect(lpExposureRow({ exposureChange: E / 10n, worth: w, fromBtc: true }).sub).toBe("pool share only; the BTC you deposit leaves your wallet");
  });

  it("keeps a negative change's sign and needs no worth", () => {
    const row = lpExposureRow({ exposureChange: -E / 10n, worth: null, fromBtc: false });
    expect(row.value).toBe(`−${btc(E / 10n)}`);
    expect(row.sub).toBeUndefined();
  });
});

describe("priceImpactRow", () => {
  it("adds the impact's cost from 1%", () => {
    expect(priceImpactRow({ musdToSwap: 500n * E, priceImpact: E / 50n } as never)).toEqual({
      label: "Price impact",
      value: "2%",
      sub: `≈ ${musdShort(10n * E)} · includes the pool's swap fee`,
      tone: "warning",
    });
  });

  it("stays plain below 1%", () => {
    expect(priceImpactRow({ musdToSwap: 500n * E, priceImpact: E / 2500n } as never)).toEqual({
      label: "Price impact",
      value: "0.04%",
      sub: "includes the pool's swap fee",
    });
  });

  it("prices a BTC entry's impact in BTC", () => {
    expect(priceImpactRow({ btcIn: E, btcToSwap: E / 2n, priceImpact: E / 50n } as never).sub).toBe(`≈ ${btcFine(E / 100n)} · includes the pool's swap fee`);
  });
});

describe("lpReceive", () => {
  it("leads with the MUSD value and keeps the minimum", () => {
    expect(lpReceive({ worth: w, liquidity: 10n * E, minLpOut: (99n * E) / 10n })).toEqual({
      value: `LP worth ≈ ${musdShort(190n * E)}`,
      minimum: `≈ ${lpShort(10n * E)} · at least ${lpShort((99n * E) / 10n)}`,
      note: entryGapLine(w),
    });
  });

  it("has no note within 1% of what was put in", () => {
    const close = entryWorth(quote, 900n * E, 191n * E);
    expect(lpReceive({ worth: close, liquidity: 10n * E, minLpOut: 9n * E }).note).toBeNull();
  });
});

describe("lpDetailsRows (U18 §1)", () => {
  const rest = [{ label: "Network fee", value: "0.00001 BTC" }];

  it("puts Below what you put in before Network fee", () => {
    const rows = lpDetailsRows(entryWorth(quote, 900n * E, 200n * E), rest);
    expect(rows.map((r) => r.label)).toEqual(["Below what you put in", "Network fee"]);
  });

  it("adds nothing without a gap or a worth", () => {
    expect(lpDetailsRows(entryWorth(quote, 900n * E, 180n * E), rest)).toEqual(rest);
    expect(lpDetailsRows(null, rest)).toEqual(rest);
  });
});
