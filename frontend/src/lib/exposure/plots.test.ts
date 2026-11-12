import { describe, expect, it } from "vitest";
import { atRiskTrove, deployerTrove, lpShare, snapshotWith, spPosition } from "@/lib/dashboard/test-fixtures";
import { WAD } from "@/lib/math";
import { exposure } from "./exposure";
import { mcrCrossing } from "./moves";
import { baselineFor, breakdownSources, chartPlots, crossingLabel, exposureHeadline, valueSeries } from "./plots";

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

// U15: with one value line, a dashed "Kept in MUSD" line at today's value shows what the BTC move does to it.
describe("baselineFor", () => {
  const lp = valueSeries({ lpValue: 100n * WAD, spDeposit: 0n, spBtcGain: 0n, price: WAD })!;

  it("is flat at today's value for one line", () => {
    const base = baselineFor(lp);
    expect(base?.id).toBe("baseline");
    expect(new Set(base?.points.map((p) => p.value))).toEqual(new Set([100]));
    expect(base?.points.map((p) => p.move)).toEqual(lp[0].points.map((p) => p.move));
  });

  it("is absent with two lines, which already compare each other", () => {
    expect(baselineFor(valueSeries({ lpValue: 100n * WAD, spDeposit: 50n * WAD, spBtcGain: 0n, price: WAD })!)).toBeNull();
  });

  it("follows the After line on a preview, so its gap is shaded too (the faint before line is not counted)", () => {
    const before = valueSeries({ lpValue: 40n * WAD, spDeposit: 0n, spBtcGain: 0n, price: WAD }, "before")!;
    expect(new Set(baselineFor([...lp, ...before])?.points.map((p) => p.value))).toEqual(new Set([100]));
  });
});

describe("baselineFor at a given value (U17)", () => {
  const lp = [{ id: "lp" as const, points: [{ move: -30, value: 811 }, { move: 0, value: 970 }, { move: 30, value: 1106 }] }];

  it("draws the line where the caller says: what was put in, not today's value", () => {
    expect(baselineFor(lp, 1000)?.points).toEqual([{ move: -30, value: 1000 }, { move: 0, value: 1000 }, { move: 30, value: 1000 }]);
  });

  it("keeps today's value without one", () => {
    expect(baselineFor(lp)?.points.map((p) => p.value)).toEqual([970, 970, 970]);
  });
});

describe("exposureHeadline (U17)", () => {
  it("shows only the deposit's own BTC without a wallet", () => {
    expect(exposureHeadline({ current: 6362n * 10n ** 12n, prior: 0n, scope: "deposit" })).toEqual({
      figure: "+0.006362 BTC",
      caption: "This deposit only. Connect to include your Trove and positions.",
    });
  });

  it("says a MUSD deposit adds no BTC instead of \"+0 BTC\"", () => {
    expect(exposureHeadline({ current: 2n * WAD, prior: 2n * WAD, scope: "deposit" })).toEqual({
      figure: "No BTC added",
      caption: "This deposit only. Connect to include your Trove and positions.",
    });
  });

  it("reads before → after for an account", () => {
    expect(exposureHeadline({ current: 2n * WAD, prior: WAD, scope: "account" })).toEqual({ figure: "1 BTC → 2 BTC", caption: "Total BTC exposure" });
  });

  it("is the total alone without a preview", () => {
    expect(exposureHeadline({ current: 2n * WAD, prior: null, scope: "account" })).toEqual({ figure: "2 BTC", caption: "Total BTC exposure" });
  });
});
