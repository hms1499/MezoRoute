import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpEntryCard } from "@/components/stability-pool/SpEntryCard";
import { StepList } from "@/components/ui/StepList";
import { entryRisks } from "@/lib/flow/risks";
import { LP_BTC_RISKS, LP_RISKS, SP_RISKS } from "@/lib/routes/copy";
import { ConfirmAside, ConfirmCard } from "./ConfirmCard";

// U11 §6.2: Confirm pages show the full risk list (anti-goal: no risk hidden before signing); the active step's button
// is the page's one primary. The Stability Pool card never shows a rate.

const steps = createElement(StepList as FunctionComponent<Record<string, unknown>>, {
  steps: [
    { kind: "permit", status: "idle" },
    { kind: "enter", status: "idle" },
  ],
  active: 0,
  copy: { permit: { title: "Sign a permit", detail: "Gasless.", action: "Sign" }, enter: { title: "Deposit", detail: "One transaction.", action: "Send" } },
  blocked: false,
  onRun: () => undefined,
});
const confirm = (risks: string[]) =>
  renderToStaticMarkup(
    createElement(ConfirmCard, { icon: null, title: "MUSD / BTC", overview: [{ label: "You deposit", value: "10 MUSD" }], quote: null, risks, steps }),
  );
/** Filled buttons and links (the step circles also use the accent, but they are not controls). */
const primaries = (html: string) => (html.match(/<(?:button|a)\b[^>]*class="[^"]*\bbg-accent(?![-\w/])/g) ?? []).length;
const apostrophes = (text: string) => text.replace(/'/g, "&#x27;");

describe("ConfirmCard", () => {
  it("shows every LP risk line, for MUSD, BTC and Borrow & Deploy", () => {
    for (const [input, expected] of [
      [{ borrow: false, fromBtc: false }, LP_RISKS],
      [{ borrow: false, fromBtc: true }, LP_BTC_RISKS],
      [{ borrow: true, fromBtc: false }, LP_RISKS],
    ] as const) {
      const out = confirm(entryRisks(input));
      for (const risk of expected) expect(out).toContain(apostrophes(risk));
    }
    expect(entryRisks({ borrow: true, fromBtc: false }).length).toBe(LP_RISKS.length + 1);
  });

  it("shows every Stability Pool risk line", () => {
    const out = confirm(SP_RISKS);
    for (const risk of SP_RISKS) expect(out).toContain(apostrophes(risk));
  });

  it("has at most one primary button", () => {
    expect(primaries(confirm(LP_RISKS))).toBe(1);
  });
});

describe("SpEntryCard", () => {
  const out = renderToStaticMarkup(
    createElement(SpEntryCard, {
      field: { amount: "10", onAmount: () => undefined, balance: 20n * 10n ** 18n },
      overview: [{ label: "MezoRoute fee", value: "None (direct protocol call)" }],
      notices: null,
      review: { href: "/route/stability-pool/confirm/?amount=10", disabled: false },
      details: createElement("p", null, "exposure"),
    }),
  );

  it("names its return in words, never as a rate", () => {
    expect(out).toContain("No fee · BTC from liquidations");
    expect(out).not.toContain("%");
    expect(out).not.toContain("APR");
  });

  it("has one primary button and Details", () => {
    expect(primaries(out)).toBe(1);
    expect(out).toContain('id="details"');
  });
});

// U14 §A: on a wide Confirm page the risks sit in the aside from lg; below lg they stay in the card above the steps.
// Exactly one copy is displayed at any width, and the hidden one is out of the accessibility tree (display: none).
describe("Confirm risks beside the card", () => {
  const risks = ["Impermanent loss", "Smart-contract risk"];
  const wide = renderToStaticMarkup(
    createElement(ConfirmCard, { icon: null, title: "T", overview: [{ label: "A", value: "1", group: "You pay" }], risks, steps, risksPlacement: "aside-from-lg" }),
  );
  const aside = renderToStaticMarkup(createElement(ConfirmAside, { risks }, createElement("p", { id: "facts" }, "facts")));

  it("hides the card's copy from lg", () => {
    expect(wide).toMatch(/<section[^>]*aria-labelledby="confirm-risks-card"[^>]*class="[^"]*\blg:hidden\b/);
  });

  it("shows the aside's copy from lg only, with every risk, before the aside's other panels", () => {
    expect(aside).toMatch(/^<div class="hidden lg:block">/);
    for (const risk of risks) expect(aside).toContain(risk);
    expect(aside.indexOf("Smart-contract risk")).toBeLessThan(aside.indexOf('id="facts"'));
  });

  it("gives the two headings different ids", () => {
    expect(wide).toContain('id="confirm-risks-card"');
    expect(aside).toContain('id="confirm-risks-aside"');
  });

  it("lays the overview groups in two columns from lg on a wide card only", () => {
    expect(wide).toContain("lg:grid-cols-2");
    expect(confirm(risks)).not.toContain("lg:grid-cols-2");
  });
});
