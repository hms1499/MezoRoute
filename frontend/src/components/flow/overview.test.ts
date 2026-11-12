import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Overview } from "./Overview";

describe("Overview warning rows", () => {
  it("indents the caption of a warning row below sm to line up with the value", () => {
    const out = renderToStaticMarkup(createElement(Overview, { rows: [{ label: "Gap", value: "≈ 10 MUSD", sub: "why", tone: "warning" }] }));
    expect(out).toContain("pl-5 sm:pl-0");
  });
  it("leaves other captions flush", () => {
    const out = renderToStaticMarkup(createElement(Overview, { rows: [{ label: "Exposure", value: "+1 BTC", sub: "why", tone: "btc" }] }));
    expect(out).not.toContain("pl-5");
  });
});
