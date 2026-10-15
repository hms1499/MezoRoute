import { describe, expect, it } from "vitest";
import { compareRoutes } from "@/lib/compare/comparison";
import { ONE, snapshotWith } from "@/lib/dashboard/test-fixtures";
import { lpAmountRows, lpFee, spAmountRows } from "./compare-rows";

const pool = { balance: 0n, totalSupply: 1_000n * ONE, reserveMusd: 100_000n * ONE, reserveBtc: 1_250_000_000_000_000_000n };
const compared = compareRoutes({ snapshot: snapshotWith({ musd: 50n * ONE, lp: pool }), amount: 20n * ONE, executorFeeBps: 10n });

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
