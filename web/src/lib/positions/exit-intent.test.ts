import { describe, expect, it } from "vitest";
import { exitLiquidity, exitQuery, parseExitIntent } from "./exit-intent";

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
