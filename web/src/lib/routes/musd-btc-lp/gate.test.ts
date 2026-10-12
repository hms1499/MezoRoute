import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { lacksGas } from "@/lib/dashboard/readiness";
import { quoteEntry, type EntryQuote } from "@/lib/quote/entry";
import { entryBlock, PRICE_IMPACT_LIMIT, QUOTE_TTL_MS, type EntryGateInput } from "./gate";
import { ONE, TESTNET_POOL } from "./test-fixtures";

const testnet = networks.testnet;
const QUOTE = quoteEntry(TESTNET_POOL, 100n * ONE, 10n) as EntryQuote;

function input(overrides: Partial<EntryGateInput> = {}): EntryGateInput {
  return {
    network: testnet,
    walletChainId: testnet.chainId,
    chainFeeBps: 10n,
    musdIn: 100n * ONE,
    walletMusd: 500n * ONE,
    maxMusdIn: 1_000_000n * ONE,
    quote: QUOTE,
    lacksGas: false,
    quoteAgeMs: 0,
    ...overrides,
  };
}

describe("entryBlock", () => {
  it("lets a valid entry through", () => {
    expect(entryBlock(input())).toBeNull();
  });

  it("blocks a network without an executor first", () => {
    expect(entryBlock(input({ network: networks.mainnet, walletChainId: 1 }))).toMatchObject({
      reason: "no-executor",
      outcome: { message: "Mainnet actions open after launch. Reading only." },
    });
  });

  it("blocks when the deployed fee differs from the pinned one", () => {
    expect(entryBlock(input({ chainFeeBps: 20n }))?.reason).toBe("fee-mismatch");
  });

  it("blocks the wrong chain before any amount check", () => {
    expect(entryBlock(input({ walletChainId: 1, musdIn: 10_000n * ONE }))).toMatchObject({
      reason: "wrong-network",
      outcome: { recovery: ["switch-network"] },
    });
  });

  it("keeps the button disabled without a message when there is no amount", () => {
    expect(entryBlock(input({ musdIn: null, quote: null }))).toEqual({ reason: "zero", outcome: null });
  });

  it("allows exactly the wallet balance and blocks one wei more", () => {
    expect(entryBlock(input({ walletMusd: 100n * ONE }))).toBeNull();
    expect(entryBlock(input({ walletMusd: 100n * ONE - 1n }))).toMatchObject({
      reason: "insufficient-balance",
      outcome: { message: "Amount exceeds your available MUSD." },
    });
  });

  it("allows exactly the cap and blocks one wei more", () => {
    expect(entryBlock(input({ maxMusdIn: 100n * ONE }))).toBeNull();
    expect(entryBlock(input({ maxMusdIn: 100n * ONE - 1n }))?.reason).toBe("above-cap");
  });

  it.each([
    ["no quote", null],
    ["no swap", { ...QUOTE, musdToSwap: 0n }],
    ["swap of the whole amount", { ...QUOTE, musdToSwap: QUOTE.net }],
    ["no BTC from the swap", { ...QUOTE, btcFromSwap: 0n }],
    ["no LP", { ...QUOTE, liquidity: 0n }],
  ])("blocks an amount too small to route: %s", (_name, quote) => {
    expect(entryBlock(input({ quote }))).toMatchObject({
      reason: "too-small",
      outcome: { message: "Amount is too small to route." },
    });
  });

  it("allows a price impact at the limit and blocks one above", () => {
    expect(entryBlock(input({ quote: { ...QUOTE, priceImpact: PRICE_IMPACT_LIMIT } }))).toBeNull();
    expect(entryBlock(input({ quote: { ...QUOTE, priceImpact: PRICE_IMPACT_LIMIT + 1n } }))?.reason).toBe("price-impact");
  });

  it("blocks a wallet without gas, then a stale quote", () => {
    expect(entryBlock(input({ lacksGas: true }))?.reason).toBe("needs-gas");
    expect(entryBlock(input({ quoteAgeMs: QUOTE_TTL_MS }))).toBeNull();
    expect(entryBlock(input({ quoteAgeMs: QUOTE_TTL_MS + 1 }))).toMatchObject({
      reason: "quote-expired",
      outcome: { recovery: ["refresh-quote"] },
    });
  });
});

describe("lacksGas", () => {
  it("is the dashboard's rule: empty always lacks gas, an unknown price trusts any balance", () => {
    expect(lacksGas(0n, undefined)).toBe(true);
    expect(lacksGas(1n, undefined)).toBe(false);
    expect(lacksGas(146n * 3_000_000n, 146n)).toBe(false);
    expect(lacksGas(146n * 3_000_000n - 1n, 146n)).toBe(true);
  });
});
