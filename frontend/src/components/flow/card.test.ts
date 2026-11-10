import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionCard } from "./ActionCard";
import { Details } from "./Details";
import { FlowColumn } from "./FlowColumn";
import { FlowPage } from "./FlowPage";
import { SlippagePopover } from "./SlippagePopover";

// U11 §6.1-6.2: the flow's one card, its disclosure, the slippage popover, and the centred column.

describe("ActionCard", () => {
  const out = renderToStaticMarkup(
    createElement(
      ActionCard,
      {
        icon: createElement("span", { id: "icon" }),
        title: "MUSD / BTC",
        figure: "0.3% swap fee",
        figureLabel: "Pool fee",
        risk: createElement("span", { id: "risk" }, "Impermanent loss"),
        action: createElement("button", { id: "the-action" }, "Review"),
      },
      createElement("p", null, "body"),
    ),
  );

  it("renders the action once", () => {
    expect(out.match(/id="the-action"/g)).toHaveLength(1);
  });

  it("titles the card with an h2", () => {
    expect(out).toMatch(/<h2[^>]*>MUSD \/ BTC<\/h2>/);
  });

  it("shows the risk line and the figure", () => {
    expect(out).toContain('id="risk"');
    expect(out).toContain("0.3% swap fee");
    expect(out).toContain("body");
  });
});

describe("Details", () => {
  it("is a closed details element by default", () => {
    const out = renderToStaticMarkup(createElement(Details, null, "x"));
    expect(out).toMatch(/<details[^>]*id="details"/);
    expect(out).not.toMatch(/<details[^>]*\sopen/);
  });

  it("can start open", () => {
    expect(renderToStaticMarkup(createElement(Details, { defaultOpen: true }, "x"))).toMatch(/<details[^>]*\sopen/);
  });
});

describe("SlippagePopover", () => {
  it("renders a dialog trigger with the current slippage", () => {
    const out = renderToStaticMarkup(createElement(SlippagePopover, { slippageBps: 100n, onChange: () => undefined }));
    expect(out).toContain('aria-haspopup="dialog"');
    expect(out).toContain("Slippage 1%");
  });
});

describe("FlowColumn", () => {
  it("centres one column of the flow width", () => {
    const out = renderToStaticMarkup(createElement(FlowColumn, { header: createElement("h1", null, "T") }, "c"));
    expect(out).toContain("max-w-[520px]");
    expect(out).toContain("mx-auto");
  });

  it("keeps the flow centred and puts the aside in the right rail from xl", () => {
    const out = renderToStaticMarkup(
      createElement(FlowColumn, { header: createElement("h1", null, "T"), aside: createElement("p", { id: "aside" }, "side") }, "c"),
    );
    // Equal rails either side of the 520 px column keep its left edge where every other flow page has it.
    expect(out).toContain("xl:grid-cols-[minmax(0,1fr)_520px_minmax(0,1fr)]");
    expect(out).toContain("xl:col-start-2");
    expect(out).toContain("xl:col-start-3");
    expect(out).toContain("data-flow-aside");
    expect(out).not.toContain("876");
    expect(out).not.toMatch(/\blg:/);
    expect(out).toContain('id="aside"');
    // The aside follows the flow's children in source order, so a narrower screen stacks it under them.
    expect(out.indexOf('id="aside"')).toBeGreaterThan(out.indexOf(">c<"));
  });

  it("keeps today's centred column without an aside", () => {
    const out = renderToStaticMarkup(createElement(FlowColumn, { header: createElement("h1", null, "T") }, "c"));
    expect(out).toContain("max-w-[520px]");
    expect(out).not.toContain("data-flow-aside");
  });
});

describe("FlowPage", () => {
  it("frames every state of a flow route in the flow column, and lets an aside take the page from xl", () => {
    const out = renderToStaticMarkup(createElement(FlowPage, null, createElement("p", { id: "loading" }, "Loading")));
    expect(out).toContain("max-w-[520px]");
    expect(out).toContain("mx-auto");
    expect(out).toContain("xl:has-[[data-flow-aside]]:max-w-none");
    expect(out).toContain('id="loading"');
  });
});

// Final review: the trigger wraps under the tabs at 360 px; it must stay at the card's right edge, or the right-anchored
// panel opens past the left of the screen.
describe("SlippagePopover placement", () => {
  it("keeps its root right-aligned when the settings row wraps", () => {
    const out = renderToStaticMarkup(createElement(SlippagePopover, { slippageBps: 100n, onChange: () => undefined }));
    expect(out).toMatch(/^<div class="[^"]*\bml-auto\b/);
  });
});
