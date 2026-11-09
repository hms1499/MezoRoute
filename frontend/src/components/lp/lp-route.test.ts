import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LpEntryCard } from "./LpEntryCard";

// U11 §6.2: the LP amount page is one action card with Review as its only primary, and Details below it.

const props = {
  header: { label: "At this week's rate", value: "≈ 41.0% APR" },
  tabs: createElement("div", null, "tabs"),
  slippageBps: 100n as const,
  onSlippage: () => undefined,
  field: {
    token: "btc" as const,
    tokens: ["musd", "btc"] as ("musd" | "btc")[],
    balance: 10n * 10n ** 18n,
    max: 6n * 10n ** 18n,
    label: "You deposit",
    balanceLabel: "Balance",
    amount: "",
    onAmount: () => undefined,
    onToken: () => undefined,
  },
  receive: { value: "≈ 0.017962 LP", minimum: "At least 0.017782 LP" },
  stake: createElement("div", null, "stake row"),
  overview: [{ label: "MezoRoute fee", value: "0.01 MUSD" }],
  notices: null,
  risk: "Impermanent loss and MEZO price risk",
  action: { label: "Review", href: "/route/lp/confirm/?amount=1", disabled: false },
  details: createElement("p", null, "What happens"),
};

describe("LpEntryCard", () => {
  const out = renderToStaticMarkup(createElement(LpEntryCard, props));

  it("has one primary button, Review", () => {
    expect(out.match(/bg-accent(?![-\w])/g)).toHaveLength(1);
    expect(out).toMatch(/bg-accent(?![-\w])[^>]*>[\s\S]*?Review/);
  });

  it("states this week's rate", () => {
    expect(out).toContain("this week");
  });

  it("has no dollar figure", () => {
    expect(out).not.toContain("$");
  });

  it("puts What happens behind Details and links the risk line to it", () => {
    expect(out).toContain('id="details"');
    expect(out).toContain('href="#details"');
    expect(out).toContain("What happens");
  });

  it("opens the token menu for MUSD | BTC", () => {
    expect(out).toContain('aria-haspopup="menu"');
  });

  it("makes the way out the primary when a recovery is offered", () => {
    const blocked = renderToStaticMarkup(
      createElement(LpEntryCard, {
        ...props,
        action: { label: "Borrow & Deploy instead", onClick: () => undefined },
      }),
    );
    expect(blocked.match(/bg-accent(?![\w-])/g)).toHaveLength(1);
    expect(blocked).toContain("Borrow &amp; Deploy instead");
    expect(blocked).not.toContain(">Review<");
  });

  it("renders a disabled primary inert", () => {
    const blocked = renderToStaticMarkup(createElement(LpEntryCard, { ...props, action: { label: "Review", href: "#", disabled: true } }));
    expect(blocked).toContain('aria-disabled="true"');
    expect(blocked).not.toContain('href="#"');
  });

  it("keeps an external recovery out of the arrow", () => {
    const external = renderToStaticMarkup(
      createElement(LpEntryCard, {
        ...props,
        action: { label: "Get test BTC", href: "https://faucet.test.mezo.org", external: true },
      }),
    );
    expect(external).toContain('target="_blank"');
    expect(external).not.toContain("btn-circle");
  });

  it("keeps the card to the decision rows", () => {
    const out = renderToStaticMarkup(
      createElement(LpEntryCard, {
        ...props,
        overview: [
          { label: "Deposited to the pool", value: "1,000 MUSD" },
          { label: "MezoRoute fee", value: "1 MUSD" },
          { label: "Price impact", value: "0.1%" },
          { label: "Staking", value: "On" },
        ],
        context: [{ label: "Network fee", value: "0.00001 BTC" }],
      }),
    );
    const detailsAt = out.indexOf('id="details"');
    expect(detailsAt).toBeGreaterThan(-1);
    expect(out.indexOf("Network fee")).toBeGreaterThan(detailsAt);
    expect(out.slice(0, detailsAt).match(/<dt/g)).toHaveLength(4);
  });

  it("renders no empty overview box in Details", () => {
    const out = renderToStaticMarkup(createElement(LpEntryCard, { ...props, context: [] }));
    expect(out.match(/<dl/g)).toHaveLength(1);
  });
});
