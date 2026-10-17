import { describe, expect, it } from "vitest";
import { WAD } from "@/lib/math";
import { quoteEntry } from "@/lib/quote/entry";
import { lpBacktest } from "./lp-backtest";
import { MAINNET_POOL_NOW, MAINNET_POOL_PAST, MAINNET_SECONDS, ONE } from "./test-fixtures";

const AMOUNT = 1_000n * ONE;
const live = (executorFeeBps = 0n) =>
  lpBacktest({
    past: MAINNET_POOL_PAST,
    now: MAINNET_POOL_NOW,
    amount: AMOUNT,
    executorFeeBps,
    seconds: MAINNET_SECONDS,
  });

describe("lpBacktest", () => {
  it("enters at the past pool state exactly as the executor would", () => {
    expect(live()?.liquidity).toBe(quoteEntry(MAINNET_POOL_PAST, AMOUNT, 0n)?.liquidity);
  });

  it("earns the fee index growth on its LP, token by token", () => {
    const result = live()!;
    const { indexMusd: musd0, indexBtc: btc0 } = MAINNET_POOL_PAST;
    const { indexMusd: musd1, indexBtc: btc1 } = MAINNET_POOL_NOW;
    expect(result.feesMusd).toBe((result.liquidity * (musd1 - musd0)) / WAD);
    expect(result.feesBtc).toBe((result.liquidity * (btc1 - btc0)) / WAD);
    const poolPrice = (MAINNET_POOL_NOW.reserveMusd * WAD) / MAINNET_POOL_NOW.reserveBtc;
    expect(result.feesValue).toBe(result.feesMusd + (result.feesBtc * poolPrice) / WAD);
  });

  it("matches the live mainnet window: ≈0.12% fees in 29 days, ≈1.6% a year", () => {
    const result = live()!;
    expect(result.feeReturn).toBeGreaterThan(1_200_000_000_000_000n); // 0.12%
    expect(result.feeReturn).toBeLessThan(1_300_000_000_000_000n); // 0.13%
    expect(result.feeRate).toBeGreaterThan(15_000_000_000_000_000n); // 1.5%
    expect(result.feeRate).toBeLessThan(16_500_000_000_000_000n); // 1.65%
    // BTC rose ≈7% over the window (pool price 76,913 → 82,556), so the half-BTC position is worth ≈3.5% more, fees included.
    expect(result.valueNow).toBeGreaterThan(1_020n * ONE);
    expect(result.valueNow).toBeLessThan(1_040n * ONE);
  });

  it("values today's share plus fees and refunds at today's pool price, not the oracle (an exit sells BTC into the pool)", () => {
    const result = live()!;
    const quote = quoteEntry(MAINNET_POOL_PAST, AMOUNT, 0n)!;
    const poolPrice = (MAINNET_POOL_NOW.reserveMusd * WAD) / MAINNET_POOL_NOW.reserveBtc;
    const musd = (result.liquidity * MAINNET_POOL_NOW.reserveMusd) / MAINNET_POOL_NOW.totalSupply;
    const btc = (result.liquidity * MAINNET_POOL_NOW.reserveBtc) / MAINNET_POOL_NOW.totalSupply;
    expect(result.valueNow).toBe(
      musd + quote.musdRefund + result.feesMusd + ((btc + result.feesBtc + quote.btcRefund) * poolPrice) / WAD,
    );
  });

  it("earns nothing without swaps, and loses only the entry costs", () => {
    const result = lpBacktest({
      past: MAINNET_POOL_PAST,
      now: MAINNET_POOL_PAST,
      amount: AMOUNT,
      executorFeeBps: 0n,
      seconds: MAINNET_SECONDS,
    })!;
    expect(result.feesValue).toBe(0n);
    expect(result.feeReturn).toBe(0n);
    expect(result.feeRate).toBe(0n);
    expect(result.valueNow).toBeLessThan(AMOUNT);
    expect(result.valueNow).toBeGreaterThan((AMOUNT * 99n) / 100n);
  });

  it("charges the executor fee before entering", () => {
    expect(live(10n)!.liquidity).toBeLessThan(live(0n)!.liquidity);
  });

  it("returns null for an empty pool", () => {
    const empty = { ...MAINNET_POOL_PAST, reserveMusd: 0n, reserveBtc: 0n, totalSupply: 0n };
    expect(
      lpBacktest({ past: empty, now: MAINNET_POOL_NOW, amount: AMOUNT, executorFeeBps: 0n, seconds: 1n }),
    ).toBeNull();
  });
});
