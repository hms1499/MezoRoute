import { describe, expect, it } from "vitest";
import { tokenAmountMax } from "./amount";

// U11 Review Focus 2: Max fills the balance less the gas reserve, and blocks while the gas price is unknown.

describe("tokenAmountMax", () => {
  it("fills the whole balance without a reserve (MUSD)", () => {
    expect(tokenAmountMax(10n, 0n)).toEqual({ max: 10n });
  });

  it("keeps the reserve", () => {
    expect(tokenAmountMax(10n, 4n)).toEqual({ max: 6n });
  });

  it("never goes below zero", () => {
    expect(tokenAmountMax(3n, 4n)).toEqual({ max: 0n });
  });

  it("blocks while the gas price is unknown", () => {
    expect(tokenAmountMax(10n, null)).toEqual({ blocked: "gas-price-unknown" });
  });
});
