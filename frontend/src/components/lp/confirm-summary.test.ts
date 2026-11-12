import { describe, expect, it } from "vitest";
import { ENTRY_GAP_CAUSE } from "@/lib/flow/entry-worth";
import { confirmOverview } from "./ConfirmSummary";
import { lp, musd } from "./units";

// U17 §1 "One valuation on the flow": Confirm values the LP at the oracle price, like the planner, and says the gap.

const E = 10n ** 18n;
const after = { reserveMusd: 1000n * E, reserveBtc: 1n * E, totalSupply: 100n * E };
// A tenth of the pool: 100 MUSD + 0.1 BTC, worth 190 MUSD at 900 MUSD per BTC.
const quote = (musdIn: bigint) => ({ musdIn, fee: E / 5n, musdToSwap: 100n * E, musdAdded: 100n * E, btcAdded: E / 10n, liquidity: 10n * E, after });
const minimums = { minBtcFromSwap: E / 11n, minMusdAdded: 99n * E, minBtcAdded: E / 11n, minLpOut: (99n * E) / 10n };
const data = { snapshot: { executorFeeBps: 10n, pool: after, dashboard: { price: 900n * E, gaugeReadFailed: false } } } as never;
const preview = (musdIn: bigint) =>
  ({ quote: quote(musdIn), minimums, btcQuote: null, btcMinimums: null, borrow: null, stake: { availability: "unavailable", on: false }, deadline: 0n }) as never;

const rows = (musdIn: bigint) => confirmOverview({ preview: preview(musdIn), data, slippageBps: 100n });
const text = (musdIn: bigint) => JSON.stringify(rows(musdIn));

describe("confirmOverview (U17)", () => {
  it("values the LP at the BTC price", () => {
    const received = rows(200n * E).find((row) => row.label === "LP received");
    expect(received?.sub).toBe(`≈ ${musd(190n * E)} at the BTC price · at least ${lp(minimums.minLpOut)}`);
    expect(text(200n * E)).not.toContain("at the pool price");
  });

  it("says the gap right after what is received", () => {
    const all = rows(200n * E);
    const at = all.findIndex((row) => row.label === "LP received");
    expect(all[at + 1]).toEqual({
      group: "You receive",
      label: "Below what you put in",
      value: "≈ 10 MUSD (5%)",
      sub: `at the BTC price: ${ENTRY_GAP_CAUSE}`,
      tone: "warning",
    });
  });

  it("has no gap row within 1%", () => {
    expect(text(191n * E)).not.toContain("Below what you put in");
  });

  it("does the same for a BTC entry, against the BTC at the oracle price", () => {
    const btcQuote = { btcIn: E / 4n, fee: E / 4000n, btcToSwap: E / 8n, musdAdded: 100n * E, btcAdded: E / 10n, liquidity: 10n * E, after };
    const btcMinimums = { minMusdFromSwap: 99n * E, minMusdAdded: 99n * E, minBtcAdded: E / 11n, minLpOut: (99n * E) / 10n };
    const all = confirmOverview({
      preview: { quote: null, minimums: null, btcQuote, btcMinimums, borrow: null, stake: { availability: "unavailable", on: false }, deadline: 0n } as never,
      data,
      slippageBps: 100n,
    });
    // 0.25 BTC at 900 = 225 MUSD put in; worth 190: 35 below, 15.56%.
    expect(all.find((row) => row.label === "Below what you put in")?.value).toBe("≈ 35 MUSD (15.6%)");
    expect(JSON.stringify(all)).not.toContain("at the pool price");
  });
});
