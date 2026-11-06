import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { PageHeader } from "@/components/ui/PageHeader";
import { TYPE_ROLES } from "./tokens";

// U11 §5.2: every page has exactly one visible h1; landing section titles are headline; each type role is fixed.

const SRC = join(__dirname, "../..");
const read = (file: string) => readFileSync(join(SRC, file), "utf8");

/** The component that renders the top of each page, and how it renders that page's h1. */
const PAGE_TOPS: Record<string, RegExp> = {
  "components/landing/Hero.tsx": /<h1\b/g,
  "components/dashboard/Dashboard.tsx": /<DashboardHeader\b/g,
  "components/positions/PositionsPage.tsx": /<PageHeader\b|headingLevel=\{1\}|<h1\b/g,
  "components/lp/LpRoutePage.tsx": /<PageHeader\b/g,
  "components/lp/LpConfirmPage.tsx": /<PageHeader\b/g,
  "components/positions/ExitPage.tsx": /<PageHeader\b/g,
  "components/stability-pool/SpRoutePage.tsx": /<PageHeader\b/g,
  "components/stability-pool/SpConfirmPage.tsx": /<PageHeader\b/g,
  "components/stability-pool/SpWithdrawPage.tsx": /<PageHeader\b/g,
  "components/receipt/ReceiptPage.tsx": /<PageHeader\b|<h1\b/g,
};

describe("one h1 per page", () => {
  it("renders exactly one h1 from the page headers", () => {
    expect(renderToStaticMarkup(createElement(PageHeader, { back: { href: "/", label: "Dashboard" }, title: "Your positions" })).match(/<h1\b/g)).toHaveLength(1);
    const dashboard = renderToStaticMarkup(createElement(DashboardHeader, { wallet: "MetaMask · standard wallet · 0x375a…d6e8" }));
    expect(dashboard.match(/<h1\b/g)).toHaveLength(1);
    expect(dashboard).toContain(">Dashboard</h1>");
    expect(dashboard).toContain("MetaMask · standard wallet · 0x375a…d6e8");
  });

  it("gives every page top a heading source", () => {
    for (const [file, pattern] of Object.entries(PAGE_TOPS)) expect(read(file).match(pattern)?.length ?? 0, file).toBeGreaterThanOrEqual(1);
  });

  it("uses headline for landing section titles, never title", () => {
    for (const file of ["HowItWorks", "TrustRow", "FinalCta", "RouteSection"]) {
      const h2 = read(`components/landing/${file}.tsx`).match(/<h2[^>]*className="([^"]*)"/)?.[1] ?? "";
      expect(h2, file).toContain("text-headline");
    }
  });

  it("never lets the browser's bold th show", () => {
    expect(read("app/globals.css")).toMatch(/\bth\s*\{\s*@apply text-left font-medium;/);
  });
});

describe("type roles", () => {
  it("is the spec's role table", () => {
    expect(TYPE_ROLES).toEqual({
      pageTitle: "text-title",
      landingSection: "text-headline",
      cardTitle: "text-base font-semibold",
      keyFigure: "text-figure",
      figure: "text-xl font-medium",
      body: "text-sm",
      label: "text-sm font-medium",
      caption: "text-xs",
    });
  });
});
