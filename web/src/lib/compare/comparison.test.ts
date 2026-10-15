import { describe, expect, it } from "vitest";
import { snapshotWith, spPosition } from "@/lib/dashboard/test-fixtures";
import { exposure, lpValueAfterDrop } from "@/lib/exposure/exposure";
import { WAD } from "@/lib/math";
import { quoteEntry } from "@/lib/quote/entry";
import { TESTNET_POOL } from "@/lib/routes/musd-btc-lp/test-fixtures";
import { compareRoutes } from "./comparison";

const ONE = WAD;
const POOL_PRICE = (TESTNET_POOL.reserveMusd * WAD) / TESTNET_POOL.reserveBtc; // ≈78,759 MUSD per BTC
const snapshot = snapshotWith({
  price: POOL_PRICE,
  musd: 500n * ONE,
  poolFeeBps: TESTNET_POOL.feeBps,
  lp: { balance: 0n, totalSupply: TESTNET_POOL.totalSupply, reserveMusd: TESTNET_POOL.reserveMusd, reserveBtc: TESTNET_POOL.reserveBtc },
  sp: spPosition,
});

describe("compareRoutes", () => {
  it("quotes the LP side like the LP route: executor fee, price impact, new share value", () => {
    const result = compareRoutes({ snapshot, amount: 20n * ONE, executorFeeBps: 10n });
    const quote = quoteEntry(TESTNET_POOL, 20n * ONE, 10n)!;
    if (result.lp.status !== "ok") throw new Error("expected a quote");
    expect(result.lp.fee).toBe(20_000_000_000_000_000n); // 0.1% of 20 MUSD
    expect(result.lp.priceImpact).toBe(quote.priceImpact);
    expect(result.lp.positionValue).toBeLessThan(20n * ONE);
    expect(result.lp.positionValue).toBeGreaterThan((20n * ONE * 99n) / 100n);
    expect(result.lp.valueAfterDrop).toBe(lpValueAfterDrop(result.lp.positionValue, 30));
  });

  it("adds about half the amount to BTC exposure on the LP side", () => {
    const result = compareRoutes({ snapshot, amount: 20n * ONE, executorFeeBps: 10n });
    if (result.lp.status !== "ok") throw new Error("expected a quote");
    const before = exposure(snapshot).totalBtc;
    const halfInBtc = (10n * ONE * WAD) / POOL_PRICE;
    expect(result.lp.btcBefore).toBe(before);
    expect(result.lp.btcAfter - before).toBeGreaterThan((halfInBtc * 98n) / 100n);
    expect(result.lp.btcAfter - before).toBeLessThan(halfInBtc);
  });

  it("quotes with no executor fee when the network has no executor (mainnet before M1)", () => {
    const result = compareRoutes({ snapshot, amount: 20n * ONE, executorFeeBps: null });
    expect(result.lp.status === "ok" && result.lp.fee).toBe(0n);
  });

  it("keeps the Stability Pool side in MUSD; the deposit pays the pending gain to the wallet", () => {
    const result = compareRoutes({ snapshot, amount: 20n * ONE, executorFeeBps: 10n });
    expect(result.sp.positionValue).toBe(20n * ONE);
    expect(result.sp.valueAfterDrop).toBe(20n * ONE);
    expect(result.sp.btcBefore).toBe(exposure(snapshot).totalBtc);
    expect(result.sp.btcAfter).toBe(exposure(snapshot).totalBtc - spPosition.btcGain);
  });

  it("flags an amount above the wallet balance without blocking the comparison", () => {
    expect(compareRoutes({ snapshot, amount: 600n * ONE, executorFeeBps: 10n }).overBalance).toBe(true);
    expect(compareRoutes({ snapshot, amount: 500n * ONE, executorFeeBps: 10n }).overBalance).toBe(false);
  });

  it("still compares a huge amount, with the price impact showing the cost", () => {
    const result = compareRoutes({ snapshot, amount: 1_000_000_000n * ONE, executorFeeBps: 10n });
    if (result.lp.status !== "ok") throw new Error("expected a quote");
    expect(result.lp.priceImpact).toBeGreaterThan(WAD / 2n); // over 50%
    expect(result.lp.positionValue).toBeGreaterThan(0n);
  });

  it("marks the LP side unavailable for an empty pool", () => {
    const empty = snapshotWith({ lp: { balance: 0n, totalSupply: 0n, reserveMusd: 0n, reserveBtc: 0n } });
    expect(compareRoutes({ snapshot: empty, amount: 20n * ONE, executorFeeBps: 10n }).lp).toEqual({ status: "unavailable" });
  });
});
