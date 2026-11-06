import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { withStakedLp, type DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { deployerTrove, lpShare, snapshotWith } from "@/lib/dashboard/test-fixtures";
import { GAUGE_READ_FAILED_EXPOSURE } from "@/lib/gauge/copy";
import { ExposurePanel } from "./ExposurePanel";

const render = (snapshot: DashboardSnapshot) => renderToStaticMarkup(createElement(ExposurePanel, { snapshot }));
const allStaked = withStakedLp(snapshotWith({ trove: deployerTrove, lp: { ...lpShare, balance: 0n } }), {
  alive: true,
  rewardRate: 1n,
  periodFinish: 2n,
  totalStaked: lpShare.balance,
  staked: lpShare.balance,
  earned: 0n,
});

describe("ExposurePanel with staked LP", () => {
  it("keeps the pool share, the warning, and the chart's LP line when all the LP is staked", () => {
    const out = render(allStaked);
    expect(out).toContain("MUSD/BTC pool (your share)");
    expect(out).toContain("raises your BTC exposure");
    expect(out).toContain("LP value");
    expect(out).not.toContain(GAUGE_READ_FAILED_EXPOSURE);
  });
});

describe("ExposurePanel after a failed gauge read", () => {
  it("says exposure may leave out staked LP", () => {
    expect(render({ ...allStaked, gaugeReadFailed: true })).toContain(GAUGE_READ_FAILED_EXPOSURE);
  });

  it("never says there is no exposure when it could not read the gauge", () => {
    const out = render(snapshotWith({ gaugeReadFailed: true }));
    expect(out).toContain(GAUGE_READ_FAILED_EXPOSURE);
    expect(out).not.toContain("No BTC exposure");
  });

  it("still says there is no exposure when the read worked", () => {
    const out = render(snapshotWith());
    expect(out).toContain("No BTC exposure");
    expect(out).not.toContain(GAUGE_READ_FAILED_EXPOSURE);
  });
});
