import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { exitOverview } from "@/components/positions/ExitPreviewCard";
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
});

describe("ReceiptCard", () => {
  const out = renderToStaticMarkup(
    createElement(ReceiptCard, {
      icon: null,
      title: "Deposit confirmed",
      rows: [{ label: "LP received", value: "1 LP" }],
      explorer: "https://explorer.mezo.org/tx/0x1",
    }),
  );

  it("has one h1 and one primary", () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect((out.match(/<(?:button|a)\b[^>]*class="[^"]*\bbg-accent(?![-\w/])/g) ?? []).length).toBe(1);
  });

  it("links the explorer and positions", () => {
    expect(out).toContain("View on explorer");
    expect(out).toMatch(/href="\/positions\/?"/);
  });
});
