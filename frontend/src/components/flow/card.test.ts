import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionCard } from "./ActionCard";
import { Details } from "./Details";
import { FlowColumn } from "./FlowColumn";
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
});
