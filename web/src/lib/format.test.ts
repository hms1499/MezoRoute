import { describe, expect, it } from "vitest";
import { formatPercent, formatToken, shortAddress } from "./format";

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

describe("formatToken rounding", () => {
  const debt = 2_062_416_504_131_786_872_189n;

  it("rounds down by default and up on request", () => {
    expect(formatToken(debt, 18, 2)).toBe("2,062.41");
    expect(formatToken(debt, 18, 2, "up")).toBe("2,062.42");
  });

  it("leaves exact values alone when rounding up", () => {
    expect(formatToken(5n * ONE, 18, 2, "up")).toBe("5");
  });

  it("rounds a dust amount up to the smallest shown unit", () => {
    expect(formatToken(1n, 18, 6, "up")).toBe("0.000001");
  });

  it("formats whole numbers, with a floor for non-zero dust", () => {
    expect(formatToken(50_414_625_656_554_790_209_065n, 18, 0)).toBe("50,414");
    expect(formatToken(50_414_625_656_554_790_209_065n, 18, 0, "up")).toBe("50,415");
    expect(formatToken(1n, 18, 0)).toBe("<1");
  });
});

describe("formatPercent", () => {
  it.each([
    [1_885_952_166_891_434_196n, 1, "188.5%"],
    [1_508_761_733_513_147_357n, 1, "150.8%"],
    [1_500_000_000_000_000_000n, 1, "150%"],
    [1_100_000_000_000_000_000n, 0, "110%"],
    [1_600_000_000_000_000_000n, 0, "160%"],
  ])("formats %s with %s digits as %s, truncated", (ratio, digits, expected) => {
    expect(formatPercent(ratio, digits)).toBe(expected);
  });
});
