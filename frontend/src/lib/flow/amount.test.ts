import { describe, expect, it } from "vitest";
import { MAX_FILL_DIGITS, maxFillAmount, tokenAmountMax, type FlowToken } from "./amount";

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

describe("maxFillAmount", () => {
  it("floors Max to the token's shown precision", () => {
    expect(maxFillAmount(1_234_567_891_234_567_891_234n, "musd")).toBe("1234.5678");
    expect(maxFillAmount(123_456_789_123_456_789n, "btc")).toBe("0.12345678");
    expect(maxFillAmount(1_234_999_999_999_999_999_999n, "musd")).toBe("1234.9999");
  });

  it("drops trailing zeros", () => {
    expect(maxFillAmount(10n * 10n ** 18n, "musd")).toBe("10");
    expect(maxFillAmount(150_000_000_000_000_000n, "btc")).toBe("0.15");
  });

  it("keeps zero", () => {
    expect(maxFillAmount(0n, "musd")).toBe("0");
  });

  it("never returns more precision than MAX_FILL_DIGITS", () => {
    for (const token of Object.keys(MAX_FILL_DIGITS) as FlowToken[]) {
      const fraction = maxFillAmount(10n ** 18n - 1n, token).split(".")[1] ?? "";
      expect(fraction.length).toBeLessThanOrEqual(MAX_FILL_DIGITS[token]);
    }
  });
});
