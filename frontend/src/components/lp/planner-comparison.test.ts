import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { plannerComparisonRows } from "@/lib/flow/planner-comparison";
import { PlannerComparison } from "./PlannerComparison";

const rows = plannerComparisonRows({ stake: { on: true, availability: "open" }, apr: 41n * 10n ** 16n, weekly: 3n * 10n ** 18n, poolFeeBps: 30n });
const render = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(PlannerComparison, {
      amountMusd: 1_000n * 10n ** 18n,
      example: false,
      state: { kind: "rows", rows },
      spHref: "/route/stability-pool/?amount=1000",
      ...props,
    }),
  );

describe("PlannerComparison", () => {
  it("titles the card, shows the amount, and links the Stability Pool", () => {
    const out = render();
    expect(out).toContain("Compare with the");
    expect(out).toContain("Stability Pool");
    expect(out).toContain("1,000 MUSD");
    expect(out).toContain("No annualised rate");
    // No accent fill on an action: the page owns the only primary. The one accent background is the LP dot.
    expect(out.match(/<a[^>]*class="[^"]*(?<![:-\w])bg-accent(?![\w-])/)).toBeNull();
    expect(out.match(/(?<![:-\w])bg-accent(?![\w-])/g)).toHaveLength(1);
    // Next's Link drops the trailing slash before the query.
    expect(out).toContain('href="/route/stability-pool?amount=1000"');
  });

  it("labels the example amount", () => {
    expect(render({ example: true })).toContain("Example amount");
  });

  it("drops the link in the message state", () => {
    const out = render({ state: { kind: "message", message: "Enter a valid amount to compare." }, spHref: null });
    expect(out).toContain("Enter a valid amount to compare.");
    expect(out).not.toContain("stability-pool?");
    expect(out).not.toContain("You get");
  });

  it("keeps the Stability Pool's week variable, never a rate", () => {
    const out = render();
    // The rows render label and value in separate cells, so split from the SP value, not a joined sentence.
    const sp = out.slice(out.indexOf("BTC from liquidations"));
    expect(sp).toContain("Variable · paid in bursts");
  });
});
