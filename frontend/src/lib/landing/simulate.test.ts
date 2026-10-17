import { describe, expect, it } from "vitest";
import { compareRoutes } from "@/lib/compare/comparison";
import { backtestRoutes } from "@/lib/compare/history";
import { snapshotWith } from "@/lib/dashboard/test-fixtures";
import { lpValueAfterDrop } from "@/lib/exposure/exposure";
import { MAINNET_MAX_MUSD_IN, simulateRoutes } from "./simulate";
import { history, ONE, reference } from "./test-fixtures";

describe("simulateRoutes", () => {
  it("values the LP side exactly like the dashboard comparison for an empty wallet", () => {
    const amount = 1_000n * ONE;
    const sim = simulateRoutes({ reference, history: null, amount, executorFeeBps: 10n });
    const compared = compareRoutes({
      snapshot: snapshotWith({
        lp: { balance: 0n, totalSupply: reference.lpSupply, reserveMusd: reference.reserveMusd, reserveBtc: reference.reserveBtc },
        poolFeeBps: reference.feeBps,
      }),
      amount,
      executorFeeBps: 10n,
    });
    if (sim.lp.status !== "ok" || compared.lp.status !== "ok") throw new Error("expected both quotes");
    expect(sim.lp.positionValue).toBe(compared.lp.positionValue);
    expect(sim.lp.btcAdded).toBe(compared.lp.btcAfter - compared.lp.btcBefore);
    expect(sim.lp.valueAfterDrop).toBe(compared.lp.valueAfterDrop);
    expect(sim.lp.valueAfterDrop).toBe(lpValueAfterDrop(sim.lp.positionValue, 30));
    expect(sim.lp.fee).toBe(compared.lp.fee);
  });

  it("keeps the Stability Pool side in MUSD", () => {
    const sim = simulateRoutes({ reference, history: null, amount: 500n * ONE, executorFeeBps: 10n });
    expect(sim.sp).toEqual({ positionValue: 500n * ONE, btcAdded: 0n, valueAfterDrop: 500n * ONE });
  });

  it("runs the 30-day backtest for the typed amount when the history loaded", () => {
    const amount = 100n * ONE;
    expect(simulateRoutes({ reference, history, amount, executorFeeBps: 10n }).backtests).toEqual(backtestRoutes(history, amount, 10n));
    expect(simulateRoutes({ reference, history: null, amount, executorFeeBps: 10n }).backtests).toBeNull();
  });

  it("marks amounts above the mainnet cap", () => {
    expect(simulateRoutes({ reference, history: null, amount: MAINNET_MAX_MUSD_IN, executorFeeBps: 10n }).overCap).toBe(false);
    expect(simulateRoutes({ reference, history: null, amount: 10_000n * ONE, executorFeeBps: 10n }).overCap).toBe(true);
  });

  it("has no LP quote for an empty pool", () => {
    const sim = simulateRoutes({ reference: { ...reference, reserveMusd: 0n }, history: null, amount: ONE, executorFeeBps: 10n });
    expect(sim.lp).toEqual({ status: "unavailable" });
  });
});
