import { describe, expect, it } from "vitest";
import { formatPercent } from "@/lib/format";
import { collateralRatio } from "@/lib/trove/health";
import { summaryItems } from "./summary";
import { deployerTrove, FIXTURE_PRICE, ONE, snapshotWith } from "./test-fixtures";

describe("summaryItems", () => {
  it("lists wallet MUSD, gas, BTC exposure, and 'No Trove' without one", () => {
    const items = summaryItems({ snapshot: snapshotWith({ musd: 20_373_510_296_327_363_757n }), gasBalance: 129_523_407_812_500n, gasPrice: undefined });
    expect(items).toEqual([
      { label: "MUSD in wallet", value: "20.37" },
      { label: "BTC for gas", value: "0.000129" },
      { label: "BTC exposure", value: "0", tone: "btc" },
      { label: "Trove CR", value: "No Trove" },
    ]);
  });

  it("shows the Trove's collateral ratio and counts its BTC as exposure", () => {
    const items = summaryItems({ snapshot: snapshotWith({ trove: deployerTrove }), gasBalance: ONE, gasPrice: undefined });
    expect(items[2]).toEqual({ label: "BTC exposure", value: "0.045", tone: "btc" });
    expect(items[3]).toEqual({ label: "Trove CR", value: formatPercent(collateralRatio(deployerTrove, FIXTURE_PRICE)!) });
  });
});
