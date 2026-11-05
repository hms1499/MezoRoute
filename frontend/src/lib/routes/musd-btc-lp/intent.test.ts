import { describe, expect, it } from "vitest";
import { entryQuery, parseEntryIntent } from "./intent";

const ONE = 10n ** 18n;

describe("parseEntryIntent", () => {
  it("reads the amount and the slippage from the query", () => {
    expect(parseEntryIntent(new URLSearchParams("amount=12.5&slippage=0.5"))).toEqual({
      amount: "12.5",
      musdIn: 12_500_000_000_000_000_000n,
      slippageBps: 50n,
      mode: "deposit",
      stake: true,
    });
  });

  it("defaults to 1% slippage and no amount", () => {
    expect(parseEntryIntent(new URLSearchParams(""))).toEqual({ amount: "", musdIn: null, slippageBps: 100n, mode: "deposit", stake: true });
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
    expect(parseEntryIntent(new URLSearchParams(query))).toEqual({ amount: "100", musdIn: 100n * ONE, slippageBps: 200n, mode: "deposit", stake: true });
  });

  it("omits an empty amount", () => {
    expect(entryQuery({ amount: "", slippageBps: 100n })).toBe("?slippage=1");
  });
});

describe("entry mode", () => {
  it("reads borrow mode and round-trips it; anything else is a deposit", () => {
    const query = entryQuery({ amount: "5", slippageBps: 100n, mode: "borrow" });
    expect(query).toBe("?amount=5&slippage=1&mode=borrow");
    expect(parseEntryIntent(new URLSearchParams(query)).mode).toBe("borrow");
    expect(parseEntryIntent(new URLSearchParams("mode=lever")).mode).toBe("deposit");
    expect(entryQuery({ amount: "5", slippageBps: 100n, mode: "deposit" })).toBe("?amount=5&slippage=1");
  });
});

describe("stake", () => {
  it("defaults to staking and keeps stake=0 in the URL", () => {
    expect(parseEntryIntent(new URLSearchParams("amount=5")).stake).toBe(true);
    expect(parseEntryIntent(new URLSearchParams("amount=5&stake=1")).stake).toBe(true);
    const query = entryQuery({ amount: "5", slippageBps: 100n, stake: false });
    expect(query).toBe("?amount=5&slippage=1&stake=0");
    expect(parseEntryIntent(new URLSearchParams(query)).stake).toBe(false);
    expect(entryQuery({ amount: "5", slippageBps: 100n, stake: true })).toBe("?amount=5&slippage=1");
  });
});
