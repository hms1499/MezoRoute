import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { exitDetailRows, exitOverview } from "@/components/positions/ExitPreviewCard";
import { ReceiptCard } from "@/components/receipt/ReceiptCard";
import type { ExitMinimums, ExitQuote } from "@/lib/quote/exit";
import { Overview } from "./Overview";

// U11 §6.2: the exit overview says when the exit unstakes first; the receipt is one card with one h1 and one primary.

const E18 = 10n ** 18n;
const quote: ExitQuote = { liquidityIn: E18, musdRemoved: 5n * E18, btcRemoved: E18 / 10_000n, musdFromSwap: 5n * E18, musdOut: 10n * E18, priceImpact: 10n ** 15n };
const minimums: ExitMinimums = { minMusdRemoved: 0n, minBtcRemoved: 0n, minMusdFromSwap: 0n, minMusdOut: 9n * E18 };
const render = (steps: ("unstake" | "permit" | "exit")[], unstake: bigint) =>
  renderToStaticMarkup(createElement(Overview, { rows: exitOverview({ quote, minimums, steps, unstake, gasCost: null }) }));

describe("exitOverview", () => {
  it("shows an Unstake first row when the plan unstakes", () => {
    expect(render(["unstake", "permit", "exit"], E18 / 2n)).toContain("Unstake first");
  });

  it("has no Unstake first row when the wallet holds the LP", () => {
    expect(render(["permit", "exit"], 0n)).not.toContain("Unstake first");
  });

  it("shows the minimum MUSD", () => {
    expect(render(["permit", "exit"], 0n)).toContain("9 MUSD");
  });

  // U14 final review (B2): the exit's primary was at 1179 px with staked LP; the breakdown moves behind Details.
  it("keeps only the decision rows in the card", () => {
    const labels = exitOverview({ quote, minimums, steps: ["unstake", "permit", "exit"], unstake: E18 / 2n, gasCost: null }).map((r) => r.label);
    expect(labels).toEqual(["LP to exit", "Unstake first", "Minimum you receive"]);
  });

  it("puts the pool breakdown, impact, and fees in Details", () => {
    const labels = exitDetailRows({ quote, gasCost: null }).map((r) => r.label);
    expect(labels).toEqual(["MUSD from the pool", "BTC from the pool", "Price impact", "MezoRoute fee", "Network fee (estimated)"]);
  });
});

describe("ReceiptCard", () => {
  const out = renderToStaticMarkup(
    createElement(ReceiptCard, {
      icon: null,
      title: "Deposit confirmed",
      rows: [{ label: "LP received", value: "1 LP" }],
    }),
  );

  it("has one h1 and one primary", () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect((out.match(/<(?:button|a)\b[^>]*class="[^"]*\bbg-accent(?![-\w/])/g) ?? []).length).toBe(1);
  });

  it("links positions; the explorer link lives in the page's aside (U14)", () => {
    expect(out).not.toContain("View on explorer");
    expect(out).toMatch(/href="\/positions\/?"/);
  });
});
