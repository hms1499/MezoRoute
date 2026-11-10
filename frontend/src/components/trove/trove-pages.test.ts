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

// U14 B1: with no room to leverage, the field is disabled and says why; its presets go, since none can be chosen.
describe("CrField with no room", () => {
  const html = renderToStaticMarkup(
    createElement(CrField, {
      value: "",
      onChange: () => undefined,
      presets: [2n * ONE, (25n * ONE) / 10n],
      label: "Target collateral ratio",
      disabled: true,
      description: "The pool's BTC price is about 5.0% above Mezo's oracle.",
    }),
  );

  it("disables the input and describes it with the reason", () => {
    expect(html).toMatch(/<input[^>]*id="target-cr"[^>]*aria-describedby="target-cr-description"[^>]*disabled=""/);
    expect(html).toMatch(/id="target-cr-description"[^>]*>The pool&#x27;s BTC price is about 5.0% above Mezo&#x27;s oracle.</);
  });

  it("shows no presets", () => {
    expect(html).not.toContain('role="radiogroup"');
  });
});
