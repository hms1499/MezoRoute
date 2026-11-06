import { describe, expect, it } from "vitest";
import { compareRoutes } from "@/lib/compare/comparison";
import { ONE, snapshotWith } from "@/lib/dashboard/test-fixtures";
import { lpAmountRows, lpFee, lpGaugeRows, spAmountRows, spSourceNote } from "./compare-rows";

const pool = { balance: 0n, totalSupply: 1_000n * ONE, reserveMusd: 100_000n * ONE, reserveBtc: 1_250_000_000_000_000_000n };
const compared = compareRoutes({ snapshot: snapshotWith({ musd: 50n * ONE, lp: pool }), amount: 20n * ONE, executorFeeBps: 10n });

const NOW = 1_790_000_000n;
const gauge = { alive: true, rewardRate: 481_122_999_331_598_803n, periodFinish: NOW + 400_000n, totalStaked: 500n * ONE, staked: 0n, earned: 0n };
const comparedWith = (overrides: { mezoPrice: bigint | null; timestamp?: bigint }) =>
  compareRoutes({
    snapshot: snapshotWith({ musd: 50n * ONE, lp: pool, gauge, block: { number: 1n, timestamp: overrides.timestamp ?? NOW } }),
    amount: 20n * ONE,
    executorFeeBps: 10n,
    mezoPrice: overrides.mezoPrice,
  });
const text = (rows: { label: string; value: unknown; sub?: string }[]) => JSON.stringify(rows);

describe("gauge rows", () => {
  it("shows swap fees and MEZO as alternatives, never a summed figure", () => {
    const rows = lpGaugeRows(comparedWith({ mezoPrice: 6_038_609_436_909_955n }));
    expect(rows.map((row) => row.label)).toEqual(["Swap fees (unstaked)", "MEZO, staked, this week's rate"]);
    expect(text(rows)).not.toMatch(/total|combined|plus/i);
  });

  it("labels the MEZO figure as this week's rate", () => {
    const mezo = lpGaugeRows(comparedWith({ mezoPrice: 6_038_609_436_909_955n }))[1];
    expect(mezo.sub).toContain("Changes weekly with veBTC votes; MEZO's price can fall");
    expect(mezo.sub).toMatch(/APR at this week's rate/);
    expect(String(mezo.value)).toMatch(/MEZO a week/);
  });

  it("shows MEZO amounts without APR when the price is null", () => {
    const mezo = lpGaugeRows(comparedWith({ mezoPrice: null }))[1];
    expect(String(mezo.value)).toMatch(/MEZO a week/);
    expect(mezo.sub).not.toMatch(/%/);
    expect(mezo.sub).toContain("No APR shown");
  });

  it("shows the not-set message between weeks, with no stale rate", () => {
    const mezo = lpGaugeRows(comparedWith({ mezoPrice: 6_038_609_436_909_955n, timestamp: gauge.periodFinish }))[1];
    expect(mezo.value).toBe("New week's rate not set yet");
    expect(text([mezo])).not.toMatch(/%|MEZO a week/);
  });

  it("has no gauge rows without an amount or without a gauge", () => {
    expect(lpGaugeRows(null)).toEqual([]);
    expect(lpGaugeRows(compared)).toEqual([]);
  });
});

describe("Stability Pool source", () => {
  it("states the real source with the live Trove debt from the snapshot", () => {
    expect(spSourceNote(3_000_000n * ONE)).toBe("Returns come only from liquidations. Open Trove debt today: 3,000,000 MUSD.");
    expect(spSourceNote(null)).toBeUndefined();
  });
});

describe("comparison rows", () => {
  it("has no amount rows until an amount is entered (one hint line replaces them)", () => {
    expect(lpAmountRows(null)).toEqual([]);
    expect(spAmountRows(null)).toEqual([]);
  });

  it("labels the same three amount rows for both routes, so the table lines up", () => {
    const labels = (rows: { label: string }[]) => rows.map((row) => row.label);
    expect(labels(lpAmountRows(compared))).toEqual(["Position after", "BTC exposure", "If BTC drops 30%"]);
    expect(labels(spAmountRows(compared))).toEqual(labels(lpAmountRows(compared)));
  });

  it("words the MezoRoute fee", () => {
    expect(lpFee(null, null)).toBe("Set at launch");
    expect(lpFee(10n, null)).toBe("0.1%");
    expect(lpFee(10n, compared)).toBe("0.1% (0.02 MUSD)");
  });
});
