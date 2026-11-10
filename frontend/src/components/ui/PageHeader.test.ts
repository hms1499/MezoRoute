import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";

// U12: a short heading with the long sentence under it, so the title does not take three lines at 360 px.

describe("PageHeader", () => {
  const out = renderToStaticMarkup(
    createElement(PageHeader, {
      back: { href: "/", label: "Dashboard" },
      step: 1,
      title: "Add liquidity",
      subtitle: "Collect swap fees or MEZO in the MUSD/BTC pool",
    }),
  );

  it("keeps the heading short and the sentence under it", () => {
    expect(out).toContain('<h1 class="text-title [text-wrap:balance]">Add liquidity</h1>');
    expect(out).toContain('<p class="text-sm text-muted">Collect swap fees or MEZO in the MUSD/BTC pool</p>');
  });

  it("keeps the sentence out of the heading", () => {
    const heading = out.slice(out.indexOf("<h1"), out.indexOf("</h1>"));
    expect(heading).not.toContain("Earn swap fees");
  });
});

// U14 B2: the back link and the progress share one row from sm, which gives the card back about 30 px of height.
describe("PageHeader row", () => {
  it("puts the back link and the progress side by side from sm", () => {
    const out = renderToStaticMarkup(createElement(PageHeader, { back: { href: "/", label: "Dashboard" }, step: 2, title: "Review" }));
    expect(out).toMatch(/<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><a [^>]*href="\/"[\s\S]*<ol aria-label="Progress"/);
  });
});
