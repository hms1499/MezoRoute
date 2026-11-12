import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { btc, musdShort } from "@/components/lp/units";
import { spEntryRows } from "./entry-rows";
import { SpEntryCard } from "./SpEntryCard";

// U17 §5: the Stability Pool planner without a wallet shows nothing as the visitor's (no deposit, no gain, no
// balance), and says what a BTC fall does to the deposit: nothing, until a liquidation.

const E = 10n ** 18n;
const preview = { depositNow: 40n * E, gainPaid: 7n * 10n ** 12n, depositAfter: 1040n * E, gasCost: 5n * 10n ** 11n } as never;

describe("spEntryRows", () => {
  it("shows nothing of the visitor's without a wallet", () => {
    expect(spEntryRows({ connected: false, musdIn: 1000n * E, preview }).map((row) => row.label)).toEqual(["BTC exposure", "MezoRoute fee", "Network fee (estimated)"]);
  });

  it("says what a BTC fall does to the deposit", () => {
    expect(spEntryRows({ connected: false, musdIn: 1000n * E, preview })[0]).toEqual({
      label: "BTC exposure",
      value: "None until a liquidation",
      sub: "If BTC −30%: 1,000 MUSD, unchanged · new liquidations not modelled",
    });
    expect(spEntryRows({ connected: false, musdIn: null, preview })[0].sub).toBe("new liquidations not modelled");
  });

  it("keeps the connected rows and adds the exposure row", () => {
    const rows = spEntryRows({ connected: true, musdIn: 1000n * E, preview });
    expect(rows.map((row) => row.label)).toEqual([
      "Deposit after (estimated)",
      "Your deposit now",
      "Pending BTC gain",
      "BTC exposure",
      "MezoRoute fee",
      "Network fee (estimated)",
    ]);
    expect(rows[0].value).toBe(musdShort(1040n * E));
    expect(rows[1].value).toBe(musdShort(40n * E));
    expect(rows[2]).toEqual({ label: "Pending BTC gain", value: btc(7n * 10n ** 12n), sub: "Paid to your wallet with this deposit" });
    expect(rows[4].value).toBe("None (direct protocol call)");
    expect(rows[5].value).toBe(btc(5n * 10n ** 11n));
  });

  it("has no Deposit after before an amount, and a dash without a gas price", () => {
    const rows = spEntryRows({ connected: true, musdIn: null, preview: { ...(preview as object), depositAfter: null, gasCost: null } as never });
    expect(rows.map((row) => row.label)).not.toContain("Deposit after (estimated)");
    expect(rows.at(-1)?.value).toBe("—");
  });

  it("never shows a rate", () => {
    const text = JSON.stringify(spEntryRows({ connected: false, musdIn: 1000n * E, preview }).map((row) => [row.value, row.sub]));
    expect(text).not.toMatch(/APR|earn/i);
  });
});

describe("SpEntryCard without a wallet (U17)", () => {
  const card = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      createElement(SpEntryCard, {
        field: { amount: "1000", onAmount: () => undefined, balance: null },
        overview: [],
        notices: null,
        review: { href: "/route/stability-pool/confirm/?amount=1000", disabled: false },
        details: null,
        ...props,
      } as never),
    );

  it("asks to connect instead of showing a balance or Max", () => {
    const out = card({});
    expect(out).toContain("Connect to see balance");
    expect(out).not.toContain(">Max<");
    expect(out).not.toContain("Balance 0");
  });

  it("puts the page's own action in place of Review", () => {
    const out = card({ action: createElement("button", { id: "connect" }, "Connect to review") });
    expect(out).toContain('id="connect"');
    expect(out).not.toContain(">Review<");
    expect(card({})).toContain("Review");
  });

  it("points at Before you sign above the primary, below lg only", () => {
    const out = card({ trust: "Mezo's contract; MezoRoute adds none" });
    expect(out).toMatch(/lg:hidden[^>]*>Mezo(&#x27;|')s contract; MezoRoute adds none/);
    expect(out).toContain('href="#before-you-sign"');
    expect(card({})).not.toContain("#before-you-sign");
  });
});
