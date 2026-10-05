import { describe, expect, it } from "vitest";
import { formatToken, shortAddress } from "./format";

const ONE = 10n ** 18n;

describe("formatToken", () => {
  it.each([
    [0n, "0"],
    [5n * ONE, "5"],
    [100_000_000_000_000n, "0.0001"],
    [1_234_567_891_234_567_891_234n, "1,234.567891"],
    [1_000_000_000_000n, "0.000001"],
    [ONE + 9_999_999_000_000_000n, "1.009999"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatToken(value)).toBe(expected);
  });

  it("never rounds up", () => {
    expect(formatToken(999_999_999_999_999_999n)).toBe("0.999999");
  });

  it("never shows a non-zero balance as 0", () => {
    expect(formatToken(1n)).toBe("<0.000001");
    expect(formatToken(999_999_999_999n)).toBe("<0.000001");
  });

  it("supports other decimals", () => {
    expect(formatToken(12_345n, 8)).toBe("0.000123");
  });
});

describe("shortAddress", () => {
  it("keeps the first 6 and last 4 characters", () => {
    expect(shortAddress("0x4543ba6E0D1cC63B9eDA1D1E61853A59Cf2ae22D")).toBe("0x4543…e22D");
    expect(shortAddress("bc1q4mutsjmes2wa2zqw9fjszuav4aukuv2n3z0h0s")).toBe("bc1q4m…0h0s");
  });

  it("leaves short strings alone", () => {
    expect(shortAddress("0x1234")).toBe("0x1234");
  });
});
