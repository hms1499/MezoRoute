import { describe, expect, it } from "vitest";
import { PLANNER_COMPARE_NOTE, plannerAmount, plannerComparisonRows } from "./planner-comparison";

const E18 = 10n ** 18n;
const base = { stake: { on: true, availability: "open" as const }, apr: 41n * 10n ** 16n, weekly: 3n * E18, poolFeeBps: 30n };
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

  it("says what each route gives and holds", () => {
    const { lp: lpRows, sp } = plannerComparisonRows(base);
    expect(lpRows.map((row) => row.value)).toEqual(["Swap fees + MEZO", "≈ 41% APR", "MUSD/BTC LP"]);
    expect(lpRows[2].sub).toContain("About half your MUSD becomes BTC");
    expect(sp.map((row) => `${row.label} ${row.value}`)).toEqual([
      "You get BTC from liquidations",
      "This week Variable · paid in bursts",
      "Held MUSD until a liquidation",
    ]);
  });

  it("never annualises or percentages the Stability Pool", () => {
    const { sp } = plannerComparisonRows({ ...base, stake: { on: false, availability: "unavailable" } });
    expect(sp.some((row) => `${row.label} ${row.value} ${row.sub ?? ""}`.includes("%"))).toBe(false);
    expect(sp.some((row) => /apr|earn/i.test(`${row.value} ${row.sub ?? ""}`))).toBe(false);
    expect(PLANNER_COMPARE_NOTE).toBe("No annualised rate. Withdrawals pause while any Trove is below MCR.");
  });

  it("says Swap fees without a rate when staking is off", () => {
    expect(plannerComparisonRows({ ...base, stake: { on: false, availability: "unavailable" } }).lp[0].value).toBe("Swap fees");
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
