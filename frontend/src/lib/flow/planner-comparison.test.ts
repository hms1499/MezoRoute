import { describe, expect, it } from "vitest";
import { compareHref } from "@/lib/compare/default-amount";
import { quoteEntry } from "@/lib/quote/entry";
import { entryWorth } from "./entry-worth";
import { lpWeekRate, PLANNER_COMPARE_NOTE, plannerAmount, plannerComparisonRows, plannerLpFigures, plannerLpSide } from "./planner-comparison";

const E18 = 10n ** 18n;
const figures = { liquidity: E18, btcAdded: 6362n * 10n ** 12n, valueAfterDrop: 81161n * 10n ** 16n };
const base = { amountMusd: 1000n * E18, stake: { on: true, availability: "open" as const }, apr: 41n * 10n ** 16n, weekly: 3n * E18, poolFeeBps: 30n, lp: figures };
const lp = (input: Parameters<typeof plannerComparisonRows>[0]) =>
  plannerComparisonRows(input)
    .lp.map((row) => `${row.label} ${row.value}`)
    .join(" | ");

describe("plannerComparisonRows", () => {
  it("names this week's rate on the LP side only while the week pays", () => {
    expect(lp(base)).toContain("This week ≈ 41% APR");
    expect(lp({ ...base, apr: null })).toContain("3 MEZO a week");
    expect(lp({ ...base, stake: { on: true, availability: "between-weeks" } })).toContain("New week's rate not set yet");
    expect(lp({ ...base, stake: { ...base.stake, on: false } })).toContain("Pool fee 0.3%");
    expect(lp({ ...base, stake: { on: false, availability: "unavailable" } })).toContain("Pool fee 0.3%");
  });

  it("says who gets the swap fees, following the Staking switch (U17)", () => {
    expect(plannerComparisonRows(base).lp[0]).toEqual({ label: "You get", value: "MEZO", sub: "swap fees go to veBTC voters" });
    // Staked between weeks is still staked: the fees still go to the voters.
    expect(plannerComparisonRows({ ...base, stake: { on: true, availability: "between-weeks" } }).lp.slice(0, 2)).toEqual([
      { label: "You get", value: "MEZO", sub: "swap fees go to veBTC voters" },
      { label: "This week", value: "New week's rate not set yet" },
    ]);
    expect(plannerComparisonRows({ ...base, stake: { on: false, availability: "open" }, poolFeeBps: 4n }).lp.slice(0, 2)).toEqual([
      { label: "You get", value: "Swap fees" },
      { label: "This week", value: "Pool fee 0.04%" },
    ]);
  });

  it("puts risk and exit on both routes (U17)", () => {
    const rows = plannerComparisonRows({ ...base, stake: { on: false, availability: "open" } });
    expect(rows.lp.slice(2)).toEqual([
      { label: "BTC exposure", value: "+0.006362 BTC" },
      { label: "If BTC −30%", value: "≈ 811.61 MUSD" },
      { label: "Exit", value: "Any time, at the pool price" },
    ]);
    expect(rows.sp).toEqual([
      { label: "You get", value: "BTC from liquidations" },
      { label: "This week", value: "Variable · paid in bursts" },
      { label: "BTC exposure", value: "None until a liquidation" },
      { label: "If BTC −30%", value: "1,000 MUSD", sub: "new liquidations not modelled" },
      { label: "Exit", value: "Paused while any Trove is below MCR" },
    ]);
  });

  it("never annualises or percentages the Stability Pool", () => {
    const { sp } = plannerComparisonRows({ ...base, stake: { on: false, availability: "unavailable" } });
    // "−30%" is the row's question, not a return: no value or note carries a percentage.
    expect(sp.some((row) => `${row.value} ${row.sub ?? ""}`.includes("%"))).toBe(false);
    expect(sp.some((row) => /apr|earn/i.test(`${row.value} ${row.sub ?? ""}`))).toBe(false);
    expect(PLANNER_COMPARE_NOTE).toBe("No annualised rate for the Stability Pool.");
  });

  it("survives a pool that cannot quote", () => {
    const rows = plannerComparisonRows({ ...base, lp: null, stake: { on: false, availability: "open" } });
    expect(rows.lp[2]).toEqual({ label: "BTC exposure", value: "Pool quote unavailable" });
    expect(rows.lp[3]).toEqual({ label: "If BTC −30%", value: "Pool quote unavailable" });
  });
});

describe("plannerLpFigures", () => {
  const pool = { reserveMusd: 1_000_000n * E18, reserveBtc: 13n * E18, totalSupply: 3000n * E18, feeBps: 4n };

  it("is null for a pool that cannot quote", () => {
    const empty = { reserveMusd: 0n, reserveBtc: 0n, totalSupply: 0n, feeBps: 4n };
    expect(plannerLpFigures({ pool: empty, price: 900n * E18, amountMusd: E18, executorFeeBps: 10n })).toBeNull();
  });

  it("gives both pages the same figures as the LP page's own quote (parity)", () => {
    const quote = quoteEntry(pool, 1000n * E18, 10n)!;
    const worth = entryWorth(quote, 74_000n * E18, 1000n * E18);
    expect(plannerLpFigures({ pool, price: 74_000n * E18, amountMusd: 1000n * E18, executorFeeBps: 10n })).toEqual({
      liquidity: quote.liquidity,
      btcAdded: worth.btcShare,
      valueAfterDrop: worth.valueAfterDrop,
    });
  });
});

describe("lpWeekRate", () => {
  const pool = { reserveMusd: 1_000_000n * E18, reserveBtc: 13n * E18, totalSupply: 3000n * E18, feeBps: 4n };
  const gauge = { rewardRate: E18, totalStaked: 100n * E18 } as never;

  it("has no rate unless the week pays", () => {
    expect(lpWeekRate({ gauge, availability: "between-weeks", mezoPrice: E18, liquidity: E18, pool })).toEqual({ apr: null, weekly: null });
    expect(lpWeekRate({ gauge: null, availability: "open", mezoPrice: E18, liquidity: E18, pool })).toEqual({ apr: null, weekly: null });
  });

  it("gives the APR without an amount, and MEZO a week with one", () => {
    const open = lpWeekRate({ gauge, availability: "open", mezoPrice: E18, liquidity: null, pool });
    expect(open.weekly).toBeNull();
    expect(open.apr).not.toBeNull();
    // 1 MEZO a second shared between 100 staked LP and this 1 LP.
    expect(lpWeekRate({ gauge, availability: "open", mezoPrice: null, liquidity: E18, pool })).toEqual({ apr: null, weekly: (604_800n * E18) / 101n });
  });
});

describe("compareHref", () => {
  it("carries the amount to the 30-day page", () => {
    expect(compareHref("250.5")).toBe("/compare/?amount=250.5");
    expect(compareHref("")).toBe("/compare/");
  });
});

describe("plannerAmount", () => {
  it("uses the typed amount", () => {
    expect(plannerAmount({ text: "250.5", musdIn: 2505n * 10n ** 17n, cap: 1_000n * E18 })).toEqual({
      kind: "rows",
      amountMusd: 2505n * 10n ** 17n,
      amountText: "250.5",
      example: false,
    });
  });

  it("falls back to the 1,000 MUSD example on an empty field", () => {
    expect(plannerAmount({ text: "", musdIn: null, cap: 1_000n * E18 })).toEqual({
      kind: "rows",
      amountMusd: 1_000n * E18,
      amountText: "1000",
      example: true,
    });
  });

  it("asks for a valid amount otherwise", () => {
    for (const text of ["abc", ".", "0"]) {
      expect(plannerAmount({ text, musdIn: text === "0" ? 0n : null, cap: 1_000n * E18 })).toEqual({
        kind: "message",
        message: "Enter a valid amount to compare.",
      });
    }
  });
});

describe("plannerLpSide", () => {
  const pool = { reserveMusd: 1_000_000n * E18, reserveBtc: 13n * E18, totalSupply: 3000n * E18, feeBps: 4n };
  const gauge = { rewardRate: E18, totalStaked: 100n * E18 };

  it("rates the 1,000 MUSD example with an open gauge and no MEZO price", () => {
    const side = plannerLpSide({ pool, price: 74_000n * E18, amountMusd: 1000n * E18, executorFeeBps: 10n, gauge, availability: "open", mezoPrice: null });
    expect(side.weekly).not.toBeNull();
    expect(side.weekly!).toBeGreaterThan(0n);
    const rows = plannerComparisonRows({ ...base, apr: side.apr, weekly: side.weekly, lp: side.lp });
    expect(rows.lp[1].value).toMatch(/^≈ [\d,.]+ MEZO a week$/);
  });

  it("uses the card's liquidity for a typed amount (parity)", () => {
    const quote = quoteEntry(pool, 250n * E18, 10n)!;
    const side = plannerLpSide({ pool, price: 74_000n * E18, amountMusd: 250n * E18, executorFeeBps: 10n, gauge, availability: "open", mezoPrice: null });
    expect(side.lp?.liquidity).toBe(quote.liquidity);
  });
});
