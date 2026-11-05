import { describe, expect, it } from "vitest";
import { snapshotWith, spPosition } from "@/lib/dashboard/test-fixtures";
import { exposure, lpValueAfterDrop } from "@/lib/exposure/exposure";
import { WAD } from "@/lib/math";
import { quoteEntry } from "@/lib/quote/entry";
import { TESTNET_POOL } from "@/lib/routes/musd-btc-lp/test-fixtures";
import { MAINNET_POOL_NOW } from "./test-fixtures";
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

  it("values the new share at the pool's own price, so entering never looks like a gain", () => {
    // Testnet's oracle sat ≈3% above the pool price (QA, 15 Oct 2026): valued at the oracle, 20 MUSD in read ≈20.32 MUSD.
    const oracleAbovePool = { ...snapshot, price: (POOL_PRICE * 103n) / 100n };
    const result = compareRoutes({ snapshot: oracleAbovePool, amount: 20n * ONE, executorFeeBps: 10n });
    if (result.lp.status !== "ok") throw new Error("expected a quote");
    expect(result.lp.positionValue).toBeLessThan(20n * ONE);
    expect(result.lp.positionValue).toBeGreaterThan((20n * ONE * 99n) / 100n);
  });

  it.each([
    ["1,000 MUSD on the mainnet pool (the mainnet cap)", "mainnet", 1_000n],
    ["100,000 MUSD on the mainnet pool", "mainnet", 100_000n],
    ["1,000,000 MUSD on the testnet pool (the testnet cap)", "testnet", 1_000_000n],
    ["10,000,000 MUSD on the testnet pool", "testnet", 10_000_000n],
  ] as const)("never shows a gain on entry for %s, even with a large price impact", (_, pool, musd) => {
    // Valued at the post-trade mid, the user's own swap inflated the BTC they had just bought (review, 15 Oct 2026).
    const state = pool === "mainnet" ? MAINNET_POOL_NOW : TESTNET_POOL;
    const big = snapshotWith({
      price: POOL_PRICE,
      musd: 0n,
      poolFeeBps: state.feeBps,
      lp: { balance: 0n, totalSupply: state.totalSupply, reserveMusd: state.reserveMusd, reserveBtc: state.reserveBtc },
    });
    const amount = musd * ONE;
    const result = compareRoutes({ snapshot: big, amount, executorFeeBps: 0n });
    if (result.lp.status !== "ok") throw new Error("expected a quote");
    expect(result.lp.positionValue).toBeLessThan(amount);
    expect(result.lp.valueAfterDrop).toBeLessThan((amount * 84n) / 100n);
  });

  it("marks the LP side unavailable for an empty pool", () => {
    const empty = snapshotWith({ lp: { balance: 0n, totalSupply: 0n, reserveMusd: 0n, reserveBtc: 0n } });
    expect(compareRoutes({ snapshot: empty, amount: 20n * ONE, executorFeeBps: 10n }).lp).toEqual({ status: "unavailable" });
  });
});

describe("compareRoutes gauge", () => {
  const NOW = 1_790_000_000n;
  const gaugeState = {
    alive: true,
    rewardRate: 481_122_999_331_598_803n,
    periodFinish: NOW + 400_000n,
    totalStaked: TESTNET_POOL.totalSupply / 2n,
    staked: 0n,
    earned: 0n,
  };
  const withGauge = (gauge: typeof gaugeState | null, timestamp = NOW) =>
    ({ ...snapshot, gauge, block: { number: 1n, timestamp } });
  const MEZO_PRICE = 6_038_609_436_909_955n; // 0.006 MUSD

  it("has no gauge when nobody funds it, past the 8 days between weeks can explain", () => {
    const late = compareRoutes({ snapshot: withGauge(gaugeState, gaugeState.periodFinish + 8n * 86_400n + 1n), amount: 20n * ONE, executorFeeBps: 10n, mezoPrice: MEZO_PRICE });
    expect(late.lp.status === "ok" && late.lp.gauge).toBeNull();
    const betweenWeeks = compareRoutes({ snapshot: withGauge(gaugeState, gaugeState.periodFinish + 8n * 86_400n), amount: 20n * ONE, executorFeeBps: 10n, mezoPrice: MEZO_PRICE });
    expect(betweenWeeks.lp.status === "ok" && betweenWeeks.lp.gauge).toMatchObject({ open: false });
  });

  it("has no gauge on a network without one, or when the voter no longer counts it alive", () => {
    expect(compareRoutes({ snapshot, amount: 20n * ONE, executorFeeBps: 10n }).lp).toMatchObject({ gauge: null });
    const dead = compareRoutes({ snapshot: withGauge({ ...gaugeState, alive: false }), amount: 20n * ONE, executorFeeBps: 10n, mezoPrice: MEZO_PRICE });
    expect(dead.lp.status === "ok" && dead.lp.gauge).toBeNull();
  });

  it("gives this week's MEZO and an APR while the week pays", () => {
    const result = compareRoutes({ snapshot: withGauge(gaugeState), amount: 20n * ONE, executorFeeBps: 10n, mezoPrice: MEZO_PRICE });
    if (result.lp.status !== "ok" || !result.lp.gauge) throw new Error("expected a gauge");
    expect(result.lp.gauge.open).toBe(true);
    expect(result.lp.gauge.mezoPerWeek).toBeGreaterThan(0n);
    expect(result.lp.gauge.apr).toBeGreaterThan(0n);
  });

  it("has MEZO amounts and no APR when the price is null or zero", () => {
    for (const mezoPrice of [null, 0n]) {
      const result = compareRoutes({ snapshot: withGauge(gaugeState), amount: 20n * ONE, executorFeeBps: 10n, mezoPrice });
      if (result.lp.status !== "ok" || !result.lp.gauge) throw new Error("expected a gauge");
      expect(result.lp.gauge.apr).toBeNull();
      expect(result.lp.gauge.mezoPerWeek).toBeGreaterThan(0n);
    }
  });

  it("shows no rate between weeks", () => {
    const result = compareRoutes({
      snapshot: withGauge(gaugeState, gaugeState.periodFinish),
      amount: 20n * ONE,
      executorFeeBps: 10n,
      mezoPrice: MEZO_PRICE,
    });
    expect(result.lp.status === "ok" && result.lp.gauge).toEqual({ open: false, mezoPerWeek: 0n, apr: null });
  });

  it("dilutes by the amount entered: a larger amount gives a lower APR", () => {
    const apr = (amount: bigint) => {
      const result = compareRoutes({ snapshot: withGauge(gaugeState), amount, executorFeeBps: 10n, mezoPrice: MEZO_PRICE });
      return result.lp.status === "ok" && result.lp.gauge ? result.lp.gauge.apr! : 0n;
    };
    expect(apr(1_000_000n * ONE)).toBeLessThan(apr(20n * ONE));
  });
});
