import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardGrid } from "./DashboardGrid";

// U15: from lg the left column is positions then the chart, the right column routes then the Trove, each at its own
// height (no half-empty card). Below lg the reading order is positions, routes, chart, Trove.

const block = (name: string) => createElement("p", null, name);
const out = renderToStaticMarkup(
  createElement(DashboardGrid, { positions: block("POSITIONS"), routes: block("ROUTES"), exposure: block("CHART"), trove: block("TROVE") }),
);

describe("DashboardGrid", () => {
  it("stacks positions and the chart on the left, routes and the Trove on the right from lg", () => {
    const [left, right] = out.split('class="contents lg:block lg:space-y-6"').slice(1);
    expect(left).toContain("POSITIONS");
    expect(left).toContain("CHART");
    expect(right).toContain("ROUTES");
    expect(right).toContain("TROVE");
  });

  it("reads positions, routes, chart, Trove below lg", () => {
    expect(out).toMatch(/order-1[^>]*><p>POSITIONS/);
    expect(out).toMatch(/order-2[^>]*><p>ROUTES/);
    expect(out).toMatch(/order-3[^>]*><p>CHART/);
    expect(out).toMatch(/order-4[^>]*><p>TROVE/);
  });

  it("is one grid: a column below lg, two from lg, 24 px apart", () => {
    expect(out).toMatch(/^<div class="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">/);
  });
});
