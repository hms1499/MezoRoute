import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionCard } from "./ActionCard";
import { Details } from "./Details";
import { FlowColumn, FlowState } from "./FlowColumn";
import { Overview } from "./Overview";
import { ReceiveRow } from "./ReceiveRow";
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
  // U14 §A: one page width. Every flow is Positions' grid: the card two thirds, the aside one third from lg.
  it("renders Positions' grid without an aside, at the page width", () => {
    const out = renderToStaticMarkup(createElement(FlowColumn, { header: createElement("h1", null, "T") }, "c"));
    expect(out).toContain("lg:grid-cols-3");
    expect(out).toContain("lg:col-span-2");
    expect(out).not.toContain("max-w-[520px]");
  });

  it("with an aside, puts the aside after the flow's children", () => {
    const out = renderToStaticMarkup(
      createElement(FlowColumn, { header: createElement("h1", null, "T"), aside: createElement("p", { id: "aside" }, "side") }, "c"),
    );
    expect(out).toContain("lg:grid-cols-3");
    expect(out).toContain('id="aside"');
    // The aside follows the flow's children in source order, so below lg it stacks under them.
    expect(out.indexOf('id="aside"')).toBeGreaterThan(out.indexOf(">c<"));
  });
});

describe("FlowState", () => {
  it("keeps a loading, error, or connect state on the card's edge and width, with no header", () => {
    const out = renderToStaticMarkup(createElement(FlowState, null, createElement("p", { id: "loading" }, "Loading")));
    expect(out).toMatch(/lg:col-span-2[^>]*>(<[^>]+>)*<p id="loading"/);
    expect(out).not.toContain("<h1");
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

describe("warning icons (U18)", () => {
  const ICON = /<svg[^>]*lucide-circle-alert[^>]*>/g;
  it("Overview puts one aria-hidden alert icon on the warning row only", () => {
    const out = renderToStaticMarkup(
      createElement(Overview, {
        rows: [
          { label: "Price impact", value: "2%", tone: "warning" },
          { label: "BTC", value: "1", tone: "btc" },
        ],
      }),
    );
    const icons = out.match(ICON) ?? [];
    expect(icons).toHaveLength(1);
    expect(icons[0]).toContain('aria-hidden="true"');
    expect(icons[0]).toContain("h-4 w-4");
    expect(out.indexOf("<svg")).toBeLessThan(out.indexOf("2%"));
  });

  it("ReceiveRow puts the icon before the note, then a separator and the action", () => {
    const out = renderToStaticMarkup(
      createElement(ReceiveRow, { value: "1 LP", icon: null, note: "below", noteAction: createElement("a", { href: "#x" }, "Why") }),
    );
    expect(out.indexOf("lucide-circle-alert")).toBeGreaterThan(-1);
    expect(out.indexOf("lucide-circle-alert")).toBeLessThan(out.indexOf("below"));
    expect(out).toMatch(/below.* · .*<a href="#x">Why<\/a>/);
  });
});
