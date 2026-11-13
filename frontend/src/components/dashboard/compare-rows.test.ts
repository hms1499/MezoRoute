import { subToneClass } from "./compare-rows";
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

describe("signed sub-lines (U11 §5.5)", () => {
  it("colours a gain positive, a loss negative, and anything else muted", () => {
    expect(subToneClass("positive")).toBe("text-positive");
    expect(subToneClass("negative")).toBe("text-negative");
    expect(subToneClass(null)).toBe("text-muted");
    expect(subToneClass(undefined)).toBe("text-muted");
  });
});

// U17 §6: /compare/ without a wallet read the zero address; "0 BTC → …" would present that as the visitor's exposure.
describe("amount rows without a wallet", () => {
  const compared = {
    amount: 250n * 10n ** 18n,
    overBalance: true,
    lp: { status: "ok", fee: 0n, priceImpact: 0n, positionValue: 249n * 10n ** 18n, btcBefore: 0n, btcAfter: 159n * 10n ** 13n, valueAfterDrop: 208n * 10n ** 18n, gauge: null },
    sp: { positionValue: 250n * 10n ** 18n, btcBefore: 0n, btcAfter: 0n, valueAfterDrop: 250n * 10n ** 18n },
  } as never;
  const exposure = (rows: { label: unknown; value: unknown }[]) => rows.find((row) => row.label === "BTC exposure")?.value;

  it("shows what the deposit adds, never a before of zero", () => {
    expect(exposure(lpAmountRows(compared, false))).toBe("+0.00159 BTC");
    expect(exposure(spAmountRows(compared, false))).toBe("None until a liquidation");
  });

  it("keeps before → after for a connected wallet", () => {
    expect(exposure(lpAmountRows(compared))).toBe("0 BTC → 0.00159 BTC");
    expect(exposure(spAmountRows(compared, true))).toBe("0 BTC → 0 BTC");
  });
});

describe("savings rows (U19)", () => {
  it("shows this week's MEZO for staked sMUSD and says the MUSD yield goes to the gauge", async () => {
    const { savingsGaugeRows } = await import("./compare-rows");
    const rows = savingsGaugeRows({ availability: "open", mezoPerWeek: 3_205n * ONE, apr: null });
    expect(rows.map((row) => row.label)).toEqual(["MEZO, staked, this week's rate"]);
    expect(rows[0].value).toBe("≈ 3,205 MEZO a week");
    expect(rows[0].sub).toContain("Staking sends the MUSD yield to the gauge instead.");
    expect(text(rows)).not.toMatch(/total|combined|plus/i);
  });

  it("shows no rate between weeks and no row without a gauge", async () => {
    const { savingsGaugeRows } = await import("./compare-rows");
    expect(savingsGaugeRows({ availability: "between-weeks", mezoPerWeek: null, apr: null })[0].value).toBe("New week's rate not set yet");
    expect(savingsGaugeRows({ availability: "unavailable", mezoPerWeek: null, apr: null })).toEqual([]);
    expect(savingsGaugeRows(null)).toEqual([]);
  });

  it("keeps the amount in MUSD: no BTC, and the same after a 30% BTC fall", async () => {
    const { savingsAmountRows } = await import("./compare-rows");
    const rows = savingsAmountRows(1_000n * ONE);
    expect(rows.map((row) => row.label)).toEqual(lpAmountRows(compared).map((row) => row.label));
    expect(rows[1].value).toBe("None");
    expect(rows[2].value).toBe("1,000 MUSD");
    expect(savingsAmountRows(null)).toEqual([]);
  });
});

describe("routeTabLabel (U19 review: 375 px)", () => {
  it("keeps today's tab names for two routes and shortens them for three", async () => {
    const { routeTabLabel } = await import("./compare-rows");
    expect(routeTabLabel("lp", 2)).toBe("MUSD/BTC LP");
    expect(routeTabLabel("sp", 2)).toBe("Stability Pool");
    expect(["lp", "sp", "savings"].map((id) => routeTabLabel(id as "lp" | "sp" | "savings", 3))).toEqual(["LP", "Stability Pool", "sMUSD"]);
  });
});
