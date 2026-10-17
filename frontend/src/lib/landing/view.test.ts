import { describe, expect, it } from "vitest";
import { formatToken } from "@/lib/format";
import { simulateRoutes } from "./simulate";
import { history, ONE, reference } from "./test-fixtures";
import { compactMusd, liveStrip, SIMULATOR_FOOTNOTE, simulatorNotes, simulatorRows } from "./view";

const lpBacktest = { liquidity: 0n, feesMusd: 0n, feesBtc: 0n, feesValue: 0n, valueNow: 0n, feeReturn: 1_300_000_000_000_000n, feeRate: 16_000_000_000_000_000n };
const spBacktest = { depositNow: 0n, btcGain: 0n, valueNow: 0n, gainReturn: 0n, lossReturn: 0n, liquidated: false };
const backtests = { lp: lpBacktest, sp: spBacktest, seconds: 2_592_000n, pastTime: 0n, pastBlock: 0n, headBlock: 0n };

describe("liveStrip", () => {
  it("shows skeletons while the first read runs and hides when it fails", () => {
    expect(liveStrip(undefined, null)).toEqual({ kind: "loading" });
    expect(liveStrip(undefined, new Error("fetch failed"))).toEqual({ kind: "hidden" });
  });

  it("gives the pool value and Stability Pool deposits as numbers to count up", () => {
    expect(liveStrip({ reference, backtests: null, history: null }, null)).toEqual({
      kind: "data",
      caption: "Live from Mezo mainnet. Past results, not a forecast.",
      poolValue: 201_720n * ONE, // 101,720 + 1.25 × 80,000
      lpFees: null,
      spDeposits: 14_172_031n * ONE,
      spShare: "47.4%",
    });
  });

  it("adds the 30-day LP fees, labelled fees only", () => {
    const strip = liveStrip({ reference, backtests, history: null }, null);
    expect(strip.kind === "data" && strip.lpFees).toEqual({ value: "0.13%", sub: "≈1.6% a year, fees only" });
  });

  it("keeps the figures while a refetch fails", () => {
    expect(liveStrip({ reference, backtests: null, history: null }, new Error("fetch failed")).kind).toBe("data");
  });
});

describe("compactMusd", () => {
  it("shortens millions and groups smaller amounts", () => {
    expect(compactMusd(14_172_031n * ONE)).toBe("14.17M MUSD");
    expect(compactMusd(203_056n * ONE)).toBe("203,056 MUSD");
  });
});

describe("simulatorRows", () => {
  const sim = simulateRoutes({ reference, history: null, amount: 1_000n * ONE, executorFeeBps: 10n });

  it("lists the same five rows for both routes", () => {
    expect(simulatorRows(sim).map((row) => row.label)).toEqual(["Return source", "Last 30 days", "BTC exposure", "If BTC −30%", "MezoRoute fee"]);
  });

  it("gives the LP BTC and the −30% value as figures that can count", () => {
    if (sim.lp.status !== "ok") throw new Error("expected a quote");
    const [, , btc, drop, fee] = simulatorRows(sim);
    expect(btc.lpTone).toBe("btc");
    expect(btc.lp).toMatchObject({ kind: "figure", value: sim.lp.btcAdded });
    expect(btc.lp.kind === "figure" && btc.lp.format(btc.lp.value)).toBe(`≈ +${formatToken(sim.lp.btcAdded)} BTC`);
    expect(drop.lp.kind === "figure" && drop.lp.format(drop.lp.value)).toBe(`≈ ${formatToken(sim.lp.valueAfterDrop, 18, 2)} MUSD`);
    expect(drop.sp.kind === "figure" && drop.sp.format(drop.sp.value)).toBe("1,000 MUSD");
    expect(fee.lp).toEqual({ kind: "text", text: "0.1%", figure: true });
    expect(fee.sp).toEqual({ kind: "text", text: "None" });
  });

  it("marks numeric text as a figure (mono) and words as prose", () => {
    const withHistory = simulateRoutes({ reference, history, amount: 1_000n * ONE, executorFeeBps: 10n });
    const [source, last30, btc] = simulatorRows(withHistory);
    expect(source.lp).toEqual({ kind: "text", text: "Swap fees" });
    expect(last30.lp).toMatchObject({ kind: "text", figure: true });
    expect(last30.sp).not.toHaveProperty("figure");
    expect(btc.sp).toEqual({ kind: "text", text: "0 BTC", figure: true });
  });

  it("says Unavailable for the 30-day row without history", () => {
    const [, last30] = simulatorRows(sim);
    expect(last30.lp).toEqual({ kind: "text", text: "Unavailable" });
    expect(last30.sp).toEqual({ kind: "text", text: "Unavailable" });
  });

  it("shows the signed 30-day change, and no liquidations for a quiet Stability Pool", () => {
    const withHistory = simulateRoutes({ reference, history, amount: 1_000n * ONE, executorFeeBps: 10n });
    const [, last30] = simulatorRows(withHistory);
    expect(last30.lp.kind === "text" && last30.lp.text).toMatch(/^[+−][\d,.]+ MUSD \([+−]/);
    expect(last30.sp).toEqual({ kind: "text", text: "No liquidations" });
  });

  it("says the pool quote is unavailable for an empty pool", () => {
    const empty = simulateRoutes({ reference: { ...reference, reserveMusd: 0n }, history: null, amount: ONE, executorFeeBps: 10n });
    const [, , btc] = simulatorRows(empty);
    expect(btc.lp).toEqual({ kind: "text", text: "Pool quote unavailable" });
  });
});

describe("simulatorNotes", () => {
  const at = (amount: bigint) => simulateRoutes({ reference, history: null, amount, executorFeeBps: 10n });

  it("always says the figures are past mainnet data, not a forecast", () => {
    expect(simulatorNotes(at(100n * ONE), "mainnet")).toEqual([SIMULATOR_FOOTNOTE]);
  });

  it("adds the cap note above 1,000 MUSD and the testnet note on testnet", () => {
    const notes = simulatorNotes(at(10_000n * ONE), "testnet");
    expect(notes).toContain("Above the mainnet limit of 1,000 MUSD per transaction.");
    expect(notes).toContain("You're on Testnet: these figures are Mezo mainnet; your transactions will use test tokens.");
  });
});
