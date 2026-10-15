import { describe, expect, it } from "vitest";
import { WAD } from "@/lib/math";
import type { LpBacktest } from "./lp-backtest";
import type { SpBacktest } from "./sp-backtest";
import { amountState, lpHistoryLine, REFERENCE_AMOUNT, signedChange, spHistoryLine, windowDate, windowDays } from "./view";

const ONE = WAD;

describe("amountState", () => {
  it("parses a typed amount", () => {
    expect(amountState("20")).toEqual({ amount: 20n * ONE, error: null });
    expect(amountState(" 20.5 ")).toEqual({ amount: 20_500_000_000_000_000_000n, error: null });
  });

  it.each(["", "  ", "0", "0.0", ".", "0."])("treats %j as empty, without an error", (text) => {
    expect(amountState(text)).toEqual({ amount: null, error: null });
  });

  it.each(["abc", "20,5", "-1", "1.1234567890123456789"])("rejects %j with a message", (text) => {
    const state = amountState(text);
    expect(state.amount).toBeNull();
    expect(state.error).toBe("Enter an MUSD amount like 20 or 20.5 (up to 18 decimals).");
  });
});

describe("history lines", () => {
  const lp = { feeReturn: 1_248_000_000_000_000n, feeRate: 15_750_000_000_000_000n } as LpBacktest;

  it("shows LP fees over the window and as a simple yearly rate", () => {
    expect(lpHistoryLine(lp)).toBe("Fees 0.12% (≈1.5% a year, fees only)");
  });

  it("never annualises the Stability Pool", () => {
    expect(spHistoryLine({ liquidated: false } as SpBacktest)).toBe("No liquidations reached the pool");
    expect(
      spHistoryLine({ liquidated: true, gainReturn: 160_000_000_000_000_000n, lossReturn: 100_000_000_000_000_000n } as SpBacktest),
    ).toBe("BTC gains 16% · deposit absorbed 10%");
  });
});

describe("signedChange", () => {
  it("signs the change in MUSD and percent with a true minus", () => {
    expect(signedChange(1_028_900_000_000_000_000_000n, 1_000n * ONE)).toBe("+28.9 MUSD (+2.89%)");
    expect(signedChange(990n * ONE, 1_000n * ONE)).toBe("−10 MUSD (−1%)");
    expect(signedChange(1_000n * ONE, 1_000n * ONE)).toBe("+0 MUSD (+0%)");
  });
});

describe("window labels", () => {
  it("dates the window start in UTC and counts whole days", () => {
    expect(windowDate(1_789_528_999n)).toBe("Sep 16");
    expect(windowDays(2_499_138n)).toBe(29);
    expect(REFERENCE_AMOUNT).toBe(1_000n * ONE);
  });
});
