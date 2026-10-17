import { describe, expect, it } from "vitest";
import { parseSpWithdrawPercent, spDepositQuery, spWithdrawQuery } from "./intent";

describe("Stability Pool intents", () => {
  it("carries only the typed amount", () => {
    expect(spDepositQuery("12.5")).toBe("?amount=12.5");
    expect(spDepositQuery("")).toBe("");
  });

  it.each([
    ["25", 25],
    ["100", 100],
    ["33", 100],
    [null, 100],
  ] as const)("percent %j → %s", (param, percent) => {
    expect(parseSpWithdrawPercent(new URLSearchParams(param === null ? "" : `percent=${param}`))).toBe(percent);
  });

  it("round-trips the percent", () => {
    expect(parseSpWithdrawPercent(new URLSearchParams(spWithdrawQuery(50)))).toBe(50);
  });
});
