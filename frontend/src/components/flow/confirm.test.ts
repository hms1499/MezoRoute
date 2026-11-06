import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpEntryCard } from "@/components/stability-pool/SpEntryCard";
import { StepList } from "@/components/ui/StepList";
import { entryRisks } from "@/lib/flow/risks";
import { LP_BTC_RISKS, LP_RISKS, SP_RISKS } from "@/lib/routes/copy";
import { ConfirmCard } from "./ConfirmCard";

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
