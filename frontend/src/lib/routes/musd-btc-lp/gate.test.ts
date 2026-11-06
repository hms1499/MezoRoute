import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { lacksGas } from "@/lib/dashboard/readiness";
import { quoteEntry, quoteEntryFromBtc, type BtcEntryQuote, type EntryQuote } from "@/lib/quote/entry";
import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";
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
    expect(entryBlock(input({ network: { ...networks.mainnet, executor: null }, walletChainId: 1 }))).toMatchObject({
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

describe("entryBlock in borrow mode", () => {
  const borrow = { canSign: true, hasTrove: true, recoveryMode: false, limit: 200n * ONE, newCr: CR_SAFETY_FLOOR };
  const borrowInput = (overrides: Partial<EntryGateInput> = {}) => input({ walletMusd: 0n, borrow, ...overrides });

  it("lets a borrow through without wallet MUSD", () => {
    expect(entryBlock(borrowInput())).toBeNull();
  });

  it.each([
    ["smart-account-borrow", { ...borrow, canSign: false }],
    ["no-trove", { ...borrow, hasTrove: false }],
    ["recovery-mode", { ...borrow, recoveryMode: true }],
  ])("blocks %s before any amount check", (reason, gate) => {
    expect(entryBlock(borrowInput({ borrow: gate, musdIn: null, quote: null }))?.reason).toBe(reason);
  });

  it("blocks a CR below the floor, then an amount above the limit", () => {
    expect(entryBlock(borrowInput({ borrow: { ...borrow, newCr: CR_SAFETY_FLOOR - 1n } }))).toMatchObject({
      reason: "cr-floor",
      outcome: { message: "This borrow would leave your Trove too close to liquidation." },
    });
    expect(entryBlock(borrowInput({ borrow: { ...borrow, limit: 100n * ONE - 1n } }))?.reason).toBe("above-headroom");
    expect(entryBlock(borrowInput({ borrow: { ...borrow, limit: 100n * ONE } }))).toBeNull();
  });
});

describe("entryBlock for a BTC entry", () => {
  const BTC_IN = 3n * 10n ** 14n;
  const BTC_QUOTE = quoteEntryFromBtc(TESTNET_POOL, BTC_IN, 10n) as BtcEntryQuote;
  const btcInput = (btc: Partial<NonNullable<EntryGateInput["btc"]>> = {}, overrides: Partial<EntryGateInput> = {}) =>
    input({
      musdIn: null,
      walletMusd: 0n,
      quote: BTC_QUOTE,
      btc: { btcIn: BTC_IN, walletBtc: 10n ** 16n, maxBtcIn: 12n * ONE, gasReserve: 1_000n, ...btc },
      ...overrides,
    });

  it("lets a valid BTC entry through without any MUSD", () => {
    expect(entryBlock(btcInput())).toBeNull();
  });

  it("keeps the button disabled without a message when there is no amount", () => {
    expect(entryBlock(btcInput({ btcIn: null }, { quote: null }))).toEqual({ reason: "zero", outcome: null });
  });

  it("allows exactly the BTC balance minus the reserve, and reports needs-gas one wei above", () => {
    expect(entryBlock(btcInput({ walletBtc: BTC_IN + 1_000n }))).toBeNull();
    expect(entryBlock(btcInput({ walletBtc: BTC_IN + 999n }))).toMatchObject({ reason: "needs-gas", outcome: { kind: "needs-gas" } });
  });

  it("reports needs-gas for a wallet whose whole balance is the entry", () => {
    expect(entryBlock(btcInput({ walletBtc: BTC_IN, gasReserve: 1_000n }))).toMatchObject({
      reason: "needs-gas",
      outcome: { message: "Keep some BTC in your wallet to pay for the network fee. Enter a little less." },
    });
  });

  it("blocks a BTC entry with a retry while the gas price is unknown, never reserving 0 (Ruling P18)", () => {
    expect(entryBlock(btcInput({ gasReserve: null }))).toMatchObject({
      reason: "gas-price-unknown",
      outcome: { kind: "rpc-unavailable", recovery: ["retry"] },
    });
  });

  it("does not block a MUSD entry on an unknown gas price", () => {
    expect(entryBlock(input({ lacksGas: false }))).toBeNull();
  });

  it("blocks more BTC than the wallet holds, in BTC", () => {
    expect(entryBlock(btcInput({ walletBtc: BTC_IN - 1n }))).toMatchObject({
      reason: "insufficient-balance",
      outcome: { message: "Amount exceeds your available BTC." },
    });
  });

  it("blocks above entryCapBtc and allows exactly the cap", () => {
    expect(entryBlock(btcInput({ maxBtcIn: BTC_IN }))).toBeNull();
    expect(entryBlock(btcInput({ maxBtcIn: BTC_IN - 1n }))).toMatchObject({ reason: "above-cap", outcome: { kind: "above-cap" } });
  });

  it.each([
    ["no swap", { ...BTC_QUOTE, btcToSwap: 0n }],
    ["swap of the whole amount", { ...BTC_QUOTE, btcToSwap: BTC_QUOTE.net }],
    ["no MUSD from the swap", { ...BTC_QUOTE, musdFromSwap: 0n }],
    ["no LP", { ...BTC_QUOTE, liquidity: 0n }],
  ])("blocks an amount too small to route: %s", (_name, quote) => {
    expect(entryBlock(btcInput({}, { quote }))?.reason).toBe("too-small");
  });

  it("applies the same price-impact limit", () => {
    expect(entryBlock(btcInput({}, { quote: { ...BTC_QUOTE, priceImpact: PRICE_IMPACT_LIMIT + 1n } }))?.reason).toBe("price-impact");
  });
});
