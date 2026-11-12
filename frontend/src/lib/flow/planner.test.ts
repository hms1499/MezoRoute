import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { quoteEntry, quoteEntryFromBtc, type BtcEntryQuote, type EntryQuote } from "@/lib/quote/entry";
import { entryBlock, type EntryBlock, type EntryGateInput } from "@/lib/routes/musd-btc-lp/gate";
import { ONE, TESTNET_POOL } from "@/lib/routes/musd-btc-lp/test-fixtures";
import { plannerAmountBlock, plannerView } from "./planner";

// U13 anti-goal: a visitor must never see the wallet's gate (an "insufficient balance" the visitor has not tried to
// fund) or a network warning before a wallet connects. U17 §3: an amount the chain itself would refuse is refused.

const block: EntryBlock = { reason: "insufficient-balance", outcome: null };
const amountBlock: EntryBlock = { reason: "above-cap", outcome: null };

describe("plannerView", () => {
  it("hides the wallet's gate and the network warning before a wallet connects", () => {
    expect(plannerView({ connected: false, block, amountBlock: null, walletChainId: 31612, chainId: 31611 })).toEqual({ block: null, wrongNetwork: false });
  });

  it("shows the amount's own block before a wallet connects (U17)", () => {
    expect(plannerView({ connected: false, block, amountBlock, walletChainId: undefined, chainId: 31611 })).toEqual({ block: amountBlock, wrongNetwork: false });
  });

  it("passes the gate and the network warning through once connected", () => {
    expect(plannerView({ connected: true, block, amountBlock, walletChainId: 31612, chainId: 31611 })).toEqual({ block, wrongNetwork: true });
    expect(plannerView({ connected: true, block: null, amountBlock, walletChainId: 31611, chainId: 31611 })).toEqual({ block: null, wrongNetwork: false });
  });

  // wagmi reports an account before the chain it sits on; warning then blames a wallet whose network is unknown.
  it("waits for the wallet's chain before warning about the network", () => {
    expect(plannerView({ connected: true, block: null, amountBlock: null, walletChainId: undefined, chainId: 31611 })).toEqual({ block: null, wrongNetwork: false });
  });
});

const testnet = networks.testnet;
const QUOTE = quoteEntry(TESTNET_POOL, 100n * ONE, 10n) as EntryQuote;

/** The gate's input as a wallet-less planner builds it: a zero balance, no gas, no wallet chain. */
function unconnected(overrides: Partial<EntryGateInput> = {}): EntryGateInput {
  return {
    network: testnet,
    walletChainId: undefined,
    chainFeeBps: 10n,
    musdIn: 100n * ONE,
    walletMusd: 0n,
    maxMusdIn: 1_000_000n * ONE,
    quote: QUOTE,
    lacksGas: true,
    quoteAgeMs: 0,
    ...overrides,
  };
}

describe("plannerAmountBlock (U17)", () => {
  it("never blames the wallet", () => {
    // The real gate, asked the same thing, answers with the wallet's network or balance.
    expect(entryBlock(unconnected())).not.toBeNull();
    expect(plannerAmountBlock(unconnected())).toBeNull();
    expect(plannerAmountBlock(unconnected({ quoteAgeMs: 10 ** 9 }))).toBeNull();
  });

  it("refuses an amount above the cap though the wallet is empty", () => {
    const refused = plannerAmountBlock(unconnected({ musdIn: 5000n * ONE, maxMusdIn: 1000n * ONE }));
    expect(refused?.reason).toBe("above-cap");
    expect(refused?.outcome?.message).toBeTruthy();
  });

  it("refuses a price impact above 5%", () => {
    expect(plannerAmountBlock(unconnected({ quote: { ...QUOTE, priceImpact: (66n * ONE) / 1000n } }))?.reason).toBe("price-impact");
  });

  it("refuses an amount too small to swap", () => {
    expect(plannerAmountBlock(unconnected({ quote: { ...QUOTE, liquidity: 0n } }))?.reason).toBe("too-small");
  });

  it("stays silent with no amount", () => {
    expect(plannerAmountBlock(unconnected({ musdIn: null, quote: null }))).toBeNull();
  });

  it("refuses a BTC entry above its cap, and nothing about the wallet's BTC", () => {
    const btcQuote = quoteEntryFromBtc(TESTNET_POOL, ONE / 100n, 10n) as BtcEntryQuote;
    const btc = { btcIn: ONE / 100n, walletBtc: 0n, maxBtcIn: 12n * ONE, gasReserve: null };
    expect(plannerAmountBlock(unconnected({ musdIn: null, quote: btcQuote, btc }))).toBeNull();
    expect(plannerAmountBlock(unconnected({ musdIn: null, quote: btcQuote, btc: { ...btc, maxBtcIn: ONE / 1000n } }))?.reason).toBe("above-cap");
  });

  it("ignores Borrow & Deploy's wallet checks", () => {
    const borrow = { canSign: false, hasTrove: false, recoveryMode: true, limit: 0n, newCr: 0n };
    expect(plannerAmountBlock(unconnected({ borrow }))).toBeNull();
  });
});
