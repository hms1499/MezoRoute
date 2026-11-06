import { describe, expect, it } from "vitest";
import { exitLiquidity, exitPlan, exitQuery, parseExitIntent } from "./exit-intent";

const params = (query: string) => new URLSearchParams(query);

describe("parseExitIntent and exitQuery", () => {
  it("round-trips the percent and the slippage", () => {
    expect(parseExitIntent(params("percent=50&slippage=0.5"))).toEqual({ percent: 50, slippageBps: 50n });
    expect(exitQuery({ percent: 50, slippageBps: 50n })).toBe("?percent=50&slippage=0.5");
  });

  it("defaults to Max and 1% for anything else", () => {
    expect(parseExitIntent(params("percent=33&slippage=9"))).toEqual({ percent: 100, slippageBps: 100n });
    expect(parseExitIntent(params(""))).toEqual({ percent: 100, slippageBps: 100n });
  });
});

describe("exitLiquidity", () => {
  it("is the exact balance at Max, so no dust stays behind", () => {
    expect(exitLiquidity(1_000_000_000_000_000_007n, 100)).toBe(1_000_000_000_000_000_007n);
  });

  it("rounds a share down", () => {
    expect(exitLiquidity(1_003n, 25)).toBe(250n);
    expect(exitLiquidity(1_003n, 75)).toBe(752n);
  });
});

describe("exitPlan", () => {
  it("spends wallet LP first", () => expect(exitPlan(40n, 60n, 50)).toEqual({ liquidityIn: 50n, unstake: 10n }));
  it("needs no unstake when the wallet covers it", () => expect(exitPlan(60n, 40n, 50)).toEqual({ liquidityIn: 50n, unstake: 0n }));
  it("Max is exact", () => expect(exitPlan(1n, 2n, 100)).toEqual({ liquidityIn: 3n, unstake: 2n }));
  it("resumes after an unstake and a reload: the wallet now holds it all", () => {
    expect(exitPlan(0n, 100n, 100)).toEqual({ liquidityIn: 100n, unstake: 100n });
    expect(exitPlan(100n, 0n, 100)).toEqual({ liquidityIn: 100n, unstake: 0n });
  });
});
