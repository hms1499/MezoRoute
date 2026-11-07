import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CrField, QueueLine } from "./TroveViews";

const ONE = 10n ** 18n;

describe("QueueLine", () => {
  it("shows the queue before and after the action with the redemption explainer", () => {
    const html = renderToStaticMarkup(
      createElement(QueueLine, { before: { debtAhead: 7_000n * ONE, rank: 4, total: 5 }, after: { debtAhead: 1_000n * ONE, rank: 2, total: 5 } }),
    );
    expect(html).toContain("Now: 7,000 MUSD of debt would be redeemed before yours (4 of 5).");
    expect(html).toContain("After: 1,000 MUSD of debt would be redeemed before yours (2 of 5).");
    expect(html).toContain("lowest collateral ratio above 110%");
  });

  it("is hidden when the queue read failed", () => {
    expect(renderToStaticMarkup(createElement(QueueLine, { before: null, after: null }))).toBe("");
  });
});

describe("CrField", () => {
  it("labels the field and offers the presets as one radio group", () => {
    const html = renderToStaticMarkup(
      createElement(CrField, { value: "250", onChange: () => undefined, presets: [2n * ONE, (25n * ONE) / 10n], label: "Target collateral ratio" }),
    );
    expect(html).toContain('for="target-cr"');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("250%");
  });
});
