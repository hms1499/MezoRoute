import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoutesTable } from "@/components/dashboard/RoutesTable";
import { GAUGE_READ_FAILED_RETRY } from "@/lib/gauge/copy";
import { YourPositionsTable } from "@/components/dashboard/YourPositionsTable";
import { positionsSnapshotWith } from "@/lib/positions/test-fixtures";
import { positionTotals } from "@/lib/positions/totals";
import { positionView } from "@/lib/positions/view";
import { spView } from "@/lib/stability-pool/position";
import { spSnapshotWith } from "@/lib/stability-pool/test-fixtures";
import { atRiskTrove, deployerTrove, snapshotWith } from "./test-fixtures";
import { dashboardStats, lpReturns } from "./stats";

// U11 §6.3: the Dashboard's stats strip shows the same total as Positions; a failed gauge read is never shown as 0.

const view = positionView(positionsSnapshotWith(), null);
const pool = spView(spSnapshotWith(), null);
const gauge = { alive: true, rewardRate: 10n ** 15n, periodFinish: 2_000_000_000n, totalStaked: 10n ** 18n, staked: 10n ** 17n, earned: 5n * 10n ** 17n };

describe("dashboardStats", () => {
  it("takes the positions value from positionTotals, as Positions does", () => {
    const stats = dashboardStats({ snapshot: snapshotWith(), health: null, totals: { view, pool, gaugeReadFailed: false } });
    expect(stats.positionsValue).toBe(positionTotals(view, pool, false)?.value);
    expect(stats.positionsValue).not.toBeNull();
  });

  it("has no positions value while Positions could not total them", () => {
    expect(dashboardStats({ snapshot: snapshotWith(), health: null, totals: { view, pool, gaugeReadFailed: true } }).positionsValue).toBeNull();
    expect(dashboardStats({ snapshot: snapshotWith(), health: null, totals: null }).positionsValue).toBeNull();
  });

  it("says there is no Trove", () => {
    expect(dashboardStats({ snapshot: snapshotWith(), health: null, totals: null }).troveCr).toBe("none");
  });

  it("marks the CR at risk when the Trove warning does", () => {
    const healthy = dashboardStats({ snapshot: snapshotWith({ trove: deployerTrove }), health: "healthy", totals: null }).troveCr;
    const risky = dashboardStats({ snapshot: snapshotWith({ trove: atRiskTrove }), health: "at-risk", totals: null }).troveCr;
    expect(healthy).not.toBe("none");
    expect(healthy !== "none" && healthy.atRisk).toBe(false);
    expect(risky !== "none" && risky.atRisk).toBe(true);
  });

  it("reads pending MEZO from the gauge, and none when its read failed (Review Focus 3)", () => {
    expect(dashboardStats({ snapshot: snapshotWith({ gauge }), health: null, totals: null }).pendingMezo).toBe(gauge.earned);
    expect(dashboardStats({ snapshot: snapshotWith({ gauge: null, gaugeReadFailed: true }), health: null, totals: null }).pendingMezo).toBeNull();
  });
});

describe("lpReturns", () => {
  it("says this week for an APR and names the swap fee otherwise", () => {
    expect(lpReturns({ availability: "open", apr: 4n * 10n ** 17n, poolFeeBps: 30n })).toBe("≈ 40% APR this week");
    expect(lpReturns({ availability: "between-weeks", apr: null, poolFeeBps: 30n })).toBe("0.3% swap fee");
    expect(lpReturns({ availability: "open", apr: null, poolFeeBps: 30n })).toBe("0.3% swap fee");
  });
});

const primaries = (html: string) => (html.match(/<(?:button|a)\b[^>]*class="[^"]*\bbg-accent(?![-\w/])/g) ?? []).length;

describe("dashboard tables", () => {
  const routes = renderToStaticMarkup(createElement(RoutesTable, { lpReturns: "≈ 40% APR this week", walletMusd: 20n * 10n ** 18n, lpHref: "/route/lp/", spHref: "/route/stability-pool/" }));
  const positions = renderToStaticMarkup(
    createElement(YourPositionsTable, {
      lp: { value: 2n * 10n ** 18n, staked: 10n ** 15n, wallet: 0n, earning: "MEZO (staked)", note: null },
      sp: { value: 50n * 10n ** 18n },
      trove: { debt: 2000n * 10n ** 18n, manageHref: "https://mezo.org" },
    }),
  );

  it("shows no dollar figure and no primary button", () => {
    for (const out of [routes, positions]) {
      expect(out).not.toContain("$");
      expect(primaries(out)).toBe(0);
    }
  });

  it("never gives the Stability Pool a rate", () => {
    const spRows = routes.split("Stability Pool").slice(1).map((part) => part.split("</tr>")[0].split("</li>")[0]);
    for (const row of spRows) expect(row).not.toContain("%");
    expect(routes).toContain("BTC from liquidations");
  });

  it("shows the LP as one row split by a caption, and the wallet MUSD", () => {
    expect(positions).toContain("staked");
    expect(positions).toContain("in wallet");
    expect(routes).toContain("20");
    expect(routes).toContain('href="#compare"');
  });
});

// Final review: an all-staked account whose gauge read failed has no LP row, and must not read "No positions yet".
describe("YourPositionsTable with a failed gauge read", () => {
  it("does not say there are no positions", () => {
    const out = renderToStaticMarkup(createElement(YourPositionsTable, { lp: null, sp: null, trove: null, gaugeReadFailed: true }));
    expect(out).not.toMatch(/No positions/);
    expect(out).toContain(GAUGE_READ_FAILED_RETRY);
  });
});
