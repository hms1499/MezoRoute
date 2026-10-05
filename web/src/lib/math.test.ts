import { describe, expect, it } from "vitest";
import { ceilDiv, isqrt, WAD } from "./math";

describe("isqrt", () => {
  it.each([
    [0n, 0n],
    [1n, 1n],
    [2n, 1n],
    [3n, 1n],
    [4n, 2n],
    [15n, 3n],
    [16n, 4n],
    [WAD * WAD, WAD],
    [(WAD + 1n) ** 2n - 1n, WAD],
    // √0.9 at 1e18 precision, the factor for a 10% drawdown.
    [900_000_000_000_000_000_000_000_000_000_000_000n, 948_683_298_050_513_799n],
  ])("isqrt(%s) = %s", (n, expected) => {
    expect(isqrt(n)).toBe(expected);
  });

  it("rejects negative input", () => {
    expect(() => isqrt(-1n)).toThrow(RangeError);
  });
});

describe("ceilDiv", () => {
  it.each([
    [7n, 2n, 4n],
    [6n, 2n, 3n],
    [0n, 5n, 0n],
  ])("ceilDiv(%s, %s) = %s", (a, b, expected) => {
    expect(ceilDiv(a, b)).toBe(expected);
  });
});
