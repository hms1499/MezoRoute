import { describe, expect, it } from "vitest";
import { spBacktest, type SpNow, type SpPast } from "./sp-backtest";
import { MAINNET_PRICE_NOW, MAINNET_SP_NOW, MAINNET_SP_PAST, ONE } from "./test-fixtures";

const FRESH: SpPast = { P: ONE, S: 0n, epoch: 0n, scale: 0n };
const now = (overrides: Partial<SpNow>): SpNow => ({
  P: ONE,
  epoch: 0n,
  scale: 0n,
  sumAtPastScale: 0n,
  sumAtNextScale: 0n,
  ...overrides,
});

describe("spBacktest", () => {
  it("matches the live testnet pool to the wei (depositor 0x4ddd…6b80af, block 16,164,226)", () => {
    const result = spBacktest({
      past: FRESH,
      now: now({ P: 862_311_608_208_321_926n, sumAtPastScale: 1_762_242_400_191_991_938_652_754_983_974n }),
      price: 0n,
      amount: 10n ** 26n,
    });
    expect(result.depositNow).toBe(86_231_160_820_832_192_600_000_000n); // getCompoundedMUSDDeposit
    expect(result.btcGain).toBe(176_224_240_019_199_193_865n); // getDepositorCollateralGain
    expect(result.liquidated).toBe(true);
  });

  it("returns the deposit unchanged when no liquidation reached the pool (mainnet, last 30 days)", () => {
    const result = spBacktest({ past: MAINNET_SP_PAST, now: MAINNET_SP_NOW, price: MAINNET_PRICE_NOW, amount: 1_000n * ONE });
    expect(result).toEqual({
      depositNow: 1_000n * ONE,
      btcGain: 0n,
      valueNow: 1_000n * ONE,
      gainReturn: 0n,
      lossReturn: 0n,
      liquidated: false,
    });
  });

  it("absorbs debt and earns BTC within one scale", () => {
    // The pool held 1,000 MUSD; a liquidation offset 100 MUSD of debt for 0.002 BTC.
    const result = spBacktest({
      past: FRESH,
      now: now({ P: 900_000_000_000_000_000n, sumAtPastScale: 2n * 10n ** 30n }),
      price: 80_000n * ONE,
      amount: 1_000n * ONE,
    });
    expect(result.depositNow).toBe(900n * ONE);
    expect(result.btcGain).toBe(2_000_000_000_000_000n);
    expect(result.valueNow).toBe(1_060n * ONE); // 900 + 0.002 × 80,000
    expect(result.gainReturn).toBe(160_000_000_000_000_000n); // 16%
    expect(result.lossReturn).toBe(100_000_000_000_000_000n); // 10%
  });

  it("follows a scale change: the deposit divides by SCALE_FACTOR and the next scale's sum counts", () => {
    const result = spBacktest({
      past: { P: 4_000_000_000n, S: 0n, epoch: 0n, scale: 0n },
      now: now({ P: ONE, scale: 1n, sumAtPastScale: 4n * 10n ** 21n, sumAtNextScale: 2n * 10n ** 30n }),
      price: 0n,
      amount: 1_000n * ONE,
    });
    expect(result.depositNow).toBe(250n * ONE);
    expect(result.btcGain).toBe(1_500_000_000_000_000n);
  });

  it("empties the deposit after more than one scale change", () => {
    const result = spBacktest({ past: FRESH, now: now({ scale: 2n }), price: 0n, amount: 1_000n * ONE });
    expect(result.depositNow).toBe(0n);
  });

  it("empties the deposit after an epoch change but keeps the old epoch's gain", () => {
    const result = spBacktest({
      past: FRESH,
      now: now({ epoch: 1n, sumAtPastScale: 2n * 10n ** 30n }),
      price: 0n,
      amount: 1_000n * ONE,
    });
    expect(result.depositNow).toBe(0n);
    expect(result.btcGain).toBe(2_000_000_000_000_000n);
    expect(result.liquidated).toBe(true);
  });

  it("treats a deposit below amount / 1e9 as gone, like the contract", () => {
    const result = spBacktest({ past: FRESH, now: now({ P: 500_000_000n }), price: 0n, amount: 1_000n * ONE });
    expect(result.depositNow).toBe(0n);
  });
});
