import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { troveActionBlock, type TroveGateInput } from "./gate";
import { quoteClose } from "./quote-close";
import { leverageQuoteAt } from "./quote-leverage";
import { quoteUnwind } from "./quote-unwind";
import type { TroveSnapshot } from "./snapshot";
import { HARNESS_MARKET, HARNESS_POOL, ONE, trove } from "./test-fixtures";

const t = trove(ONE, 40_000n * ONE);
const snapshot: TroveSnapshot = {
  trove: t,
  troveStatus: 1,
  pool: HARNESS_POOL,
  market: HARNESS_MARKET,
  system: { coll: 1_000n * ONE, debt: 20_000_000n * ONE, ccr: (15n * ONE) / 10n, troveCount: 10n },
  recoveryMode: false,
  bosNonce: 0n,
  musdPermitNonce: 0n,
  btcPermitNonce: 0n,
  walletMusd: 0n,
  walletBtc: ONE,
  surplusBtc: 0n,
  block: { number: 1n, timestamp: 1_000n },
  newTroveRateBps: 100n,
};
const unwind = quoteUnwind(t, HARNESS_POOL, HARNESS_MARKET, 3n * ONE, 50n)!;
const base: TroveGateInput = {
  action: "unwind",
  network: networks.testnet,
  walletChainId: networks.testnet.chainId,
  walletKind: "eoa",
  snapshot,
  fetchedAt: 0,
  now: 1_000,
  quote: { action: "unwind", quote: unwind },
  boundBps: 500n,
};
const reason = (over: Partial<TroveGateInput>) => troveActionBlock({ ...base, ...over })?.reason ?? null;

describe("troveActionBlock", () => {
  it("lets a fresh, valid quote through", () => {
    expect(reason({})).toBeNull();
  });

  it("not-deployed and wrong-network come first", () => {
    expect(reason({ network: { ...networks.testnet, leverage: null } })).toBe("not-deployed");
    expect(reason({ walletChainId: 1 })).toBe("wrong-network");
  });

  it("blocks smart accounts on every flash action", () => {
    for (const action of ["unwind", "close", "leverage", "open"] as const) {
      expect(reason({ action, walletKind: "smart-account" })).toBe("smart-account");
    }
  });

  it("recovery-mode blocks all three Trove actions and Open", () => {
    for (const action of ["unwind", "close", "leverage", "open"] as const) {
      expect(reason({ action, snapshot: { ...snapshot, recoveryMode: true } })).toBe("recovery-mode");
    }
  });

  it("needs a Trove for Unwind, Close and Leverage, and none for Open", () => {
    expect(reason({ snapshot: { ...snapshot, trove: null } })).toBe("no-trove");
    expect(reason({ action: "open", quote: null })).toBe("has-trove");
  });

  it("blocks a stale quote", () => {
    expect(reason({ fetchedAt: 0, now: 61_000 })).toBe("stale-quote");
  });

  it("blocks below the minimum debt, above the cap, past the oracle bound, and short capacity", () => {
    const tooMuch = { ...unwind, debtToRepay: 38_001n * ONE };
    expect(reason({ quote: { action: "unwind", quote: tooMuch } })).toBe("below-min-debt");
    const close = quoteClose(t, HARNESS_POOL, HARNESS_MARKET, 50n);
    expect(reason({ action: "close", quote: { action: "close", quote: close }, network: { ...networks.testnet, leverage: { ...networks.testnet.leverage!, maxMusdFlash: ONE } } })).toBe("above-cap");
    expect(reason({ boundBps: 0n, snapshot: { ...snapshot, market: { ...HARNESS_MARKET, price: 200_000n * ONE } } })).toBe("oracle-bound");
    const lev = leverageQuoteAt(trove(ONE, 30_000n * ONE, 0n, { maxBorrowingCapacity: 30_001n * ONE }), HARNESS_POOL, HARNESS_MARKET, 5n * ONE, 50n, 10n);
    expect(reason({ action: "leverage", quote: { action: "leverage", quote: lev } })).toBe("capacity");
  });

  it("needs the BTC an Open brings", () => {
    const s = { ...snapshot, trove: null, troveStatus: 2, walletBtc: ONE / 100n };
    expect(reason({ action: "open", snapshot: s, quote: { action: "open", btcFromUser: ONE / 10n, quote: null } })).toBe("insufficient-btc");
  });
});
