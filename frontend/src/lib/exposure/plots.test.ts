import { describe, expect, it } from "vitest";
import { atRiskTrove, deployerTrove, lpShare, snapshotWith, spPosition } from "@/lib/dashboard/test-fixtures";
import { WAD } from "@/lib/math";
import { exposure } from "./exposure";
import { mcrCrossing } from "./moves";
import { breakdownSources, chartPlots, crossingLabel, valueSeries } from "./plots";

const troveOnly = snapshotWith({ trove: deployerTrove });
const withLp = snapshotWith({ trove: deployerTrove, lp: lpShare });

describe("breakdownSources", () => {
  it("lists only the sources that hold BTC or a deposit", () => {
    expect(breakdownSources(exposure(troveOnly))).toEqual(["trove"]);
    expect(breakdownSources(exposure(withLp))).toEqual(["trove", "lp"]);
    expect(breakdownSources(exposure(snapshotWith({ lp: lpShare, sp: spPosition })))).toEqual(["lp", "sp"]);
  });
});

describe("valueSeries", () => {
  it("is null when there is nothing to value", () => {
    expect(valueSeries({ lpValue: 0n, spDeposit: 0n, spBtcGain: 0n, price: WAD })).toBeNull();
  });

  it("draws only the routes that hold value, with before ids on request", () => {
    const now = valueSeries({ lpValue: 100n * WAD, spDeposit: 0n, spBtcGain: 0n, price: WAD })!;
    expect(now.map((s) => s.id)).toEqual(["lp"]);
    const before = valueSeries({ lpValue: 100n * WAD, spDeposit: 50n * WAD, spBtcGain: 0n, price: WAD }, "before")!;
    expect(before.map((s) => s.id)).toEqual(["lp-before", "sp-before"]);
    expect(before[1].points.every((p) => p.value === 50)).toBe(true);
  });
});

describe("chartPlots", () => {
  it("has no plots without a Trove, an LP, or a deposit", () => {
    expect(chartPlots({ snapshot: snapshotWith() })).toEqual({ value: null, cr: null });
  });

  it("shows only the CR plot for a Trove alone, with the liquidation and 160% bands", () => {
    const plots = chartPlots({ snapshot: troveOnly });
    expect(plots.value).toBeNull();
    expect(plots.cr!.series.id).toBe("cr");
    expect(plots.cr!.bands).toEqual([
      { from: 0, to: 110, tone: "danger", label: "Liquidation" },
      { from: 110, to: 160, tone: "warning", label: "Below 160%" },
    ]);
    expect(plots.cr!.crossing).toBeNull();
  });

  it("adds the before lines on route previews", () => {
    const plots = chartPlots({ snapshot: withLp, before: troveOnly });
    expect(plots.value!.map((s) => s.id)).toEqual(["lp"]);
    const preview = chartPlots({ snapshot: withLp, before: snapshotWith({ trove: deployerTrove, lp: { ...lpShare, balance: 50n * WAD } }) });
    expect(preview.value!.map((s) => s.id)).toEqual(["lp", "lp-before"]);
  });

  it("marks where an at-risk Trove reaches the MCR", () => {
    const snapshot = snapshotWith({ trove: atRiskTrove });
    expect(chartPlots({ snapshot }).cr!.crossing).toEqual(mcrCrossing(snapshot));
  });
});

describe("crossingLabel", () => {
  it("rounds the liquidation price up, like the Trove card", () => {
    expect(crossingLabel(81_266_400_000_000_000_000_000n)).toBe("Liquidated below 81,267");
  });
});
