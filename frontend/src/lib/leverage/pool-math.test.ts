import { describe, expect, it } from "vitest";
import { exactInput } from "./pool-math";
import { HARNESS_POOL, ONE } from "./test-fixtures";

// Printed by contracts/test/leverage/PoolInput.t.sol `test_exactInput_logsVectors` (MezoRouteLeverage.exactInput).
const { reserveMusd: rm, reserveBtc: rb, feeBps: fee } = HARNESS_POOL;
const MUSD_FOR_BTC: [bigint, bigint][] = [
  [1_000_000_000_000_000n, 100_310_933_801_504_523_572n],
  [100_000_000_000_000_000n, 10_131_404_313_951_956_880_744n],
  [500_000_000_000_000_000n, 52_789_948_793_749_670_062_820n],
  [ONE, 111_445_447_453_471_525_688_176n],
  [3n * ONE, 429_861_011_606_247_313_368_678n],
];
const BTC_FOR_MUSD: [bigint, bigint][] = [
  [ONE, 10_030_100_300_913n],
  [1_000n * ONE, 10_040_130_401_213_651n],
  [10_000n * ONE, 101_314_043_139_519_569n],
  [50_000n * ONE, 527_899_487_937_496_701n],
  [200_000n * ONE, 2_507_522_567_703_109_327n],
];

describe("exactInput", () => {
  it.each(MUSD_FOR_BTC)("matches the contract for %s BTC out", (out, expected) => {
    expect(exactInput(rm, rb, out, fee)).toBe(expected);
  });

  it.each(BTC_FOR_MUSD)("matches the contract for %s MUSD out", (out, expected) => {
    expect(exactInput(rb, rm, out, fee)).toBe(expected);
  });

  it("is the smallest input the K check accepts", () => {
    const x = exactInput(rm, rb, ONE, fee);
    const k = (input: bigint) => (rm + input - (input * fee) / 10_000n) * (rb - ONE) >= rm * rb;
    expect(k(x)).toBe(true);
    expect(k(x - 1n)).toBe(false);
  });

  it("rejects an output at or above the reserve", () => {
    expect(() => exactInput(rm, rb, rb, fee)).toThrow();
    expect(() => exactInput(rm, rb, 0n, fee)).toThrow();
  });
});
