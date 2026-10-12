import { describe, expect, it } from "vitest";
import { entryQuery, parseEntryIntent } from "./intent";

const ONE = 10n ** 18n;

describe("parseEntryIntent", () => {
  it("reads the amount and the slippage from the query", () => {
    expect(parseEntryIntent(new URLSearchParams("amount=12.5&slippage=0.5"))).toEqual({
      amount: "12.5",
      musdIn: 12_500_000_000_000_000_000n,
      slippageBps: 50n,
    });
  });

  it("defaults to 1% slippage and no amount", () => {
    expect(parseEntryIntent(new URLSearchParams(""))).toEqual({ amount: "", musdIn: null, slippageBps: 100n });
  });

  it("never accepts a slippage outside the presets", () => {
    expect(parseEntryIntent(new URLSearchParams("amount=1&slippage=50")).slippageBps).toBe(100n);
  });

  it("keeps malformed text so the input shows it, but parses no amount", () => {
    expect(parseEntryIntent(new URLSearchParams("amount=1%2C5"))).toMatchObject({ amount: "1,5", musdIn: null });
  });
});

describe("entryQuery", () => {
  it("round-trips through parseEntryIntent", () => {
    const query = entryQuery({ amount: "100", slippageBps: 200n });
    expect(query).toBe("?amount=100&slippage=2");
    expect(parseEntryIntent(new URLSearchParams(query))).toEqual({ amount: "100", musdIn: 100n * ONE, slippageBps: 200n });
  });

  it("omits an empty amount", () => {
    expect(entryQuery({ amount: "", slippageBps: 100n })).toBe("?slippage=1");
  });
});
