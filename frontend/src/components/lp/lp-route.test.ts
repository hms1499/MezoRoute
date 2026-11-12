import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LpEntryCard } from "./LpEntryCard";
import { entryWorth } from "@/lib/flow/entry-worth";
import { lpDetailsRows } from "./LpRoutePage";
import { troveChangeRows } from "./troveChange";
import { EntryPreviewCard } from "./EntryPreviewCard";

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

  it("renders the page's own node as the one primary", () => {
    // The node's own label, so a fallback Button with the action's label cannot pass this test.
    const out = renderToStaticMarkup(
      createElement(LpEntryCard, {
        ...props,
        action: { label: "Review", node: createElement("button", { id: "connect-cta", className: "bg-accent w-full" }, "Connect to review") },
      }),
    );
    expect(out).toContain('id="connect-cta"');
    expect(out.match(/bg-accent(?![\w-])/g)).toHaveLength(1);
    expect(out).not.toContain(">Review<");
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

  it("says the entry gap under what the user receives, as a warning (U17)", () => {
    const note = "≈ 29.94 MUSD (3%) below the 1,000 MUSD you put in, at the BTC price.";
    const out = renderToStaticMarkup(createElement(LpEntryCard, { ...props, receive: { value: "LP worth ≈ 970.06 MUSD", minimum: "≈ 1.78 LP · at least 1.76 LP", note } }));
    expect(out).toMatch(new RegExp(`text-warning-ink[^>]*>(<svg.*?</svg>)?<span>${note.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    expect(out).toContain('href="#details"');
    expect(out).toContain(">Why</a>");
    expect(renderToStaticMarkup(createElement(LpEntryCard, props))).not.toContain(">Why</a>");
    expect(renderToStaticMarkup(createElement(LpEntryCard, props))).not.toContain("text-warning-ink");
  });

  it("points at Before you sign above the primary, below lg only (U17)", () => {
    const out = renderToStaticMarkup(createElement(LpEntryCard, { ...props, trust: "Unaudited software · cap 1,000 MUSD" }));
    const line = out.match(/<p class="[^"]*lg:hidden[^"]*">Unaudited software · cap 1,000 MUSD[\s\S]*?<\/p>/)?.[0];
    expect(line).toContain('href="#before-you-sign"');
    expect(out.indexOf("Unaudited software")).toBeLessThan(out.search(/bg-accent(?![-\w])/));
    expect(renderToStaticMarkup(createElement(LpEntryCard, props))).not.toContain("#before-you-sign");
  });

  it("renders no empty overview box in Details", () => {
    const out = renderToStaticMarkup(createElement(LpEntryCard, { ...props, context: [] }));
    expect(out.match(/<dl/g)).toHaveLength(1);
  });
});

describe("lpDetailsRows (U18 §1)", () => {
  const E = 10n ** 18n;
  const quote = { liquidity: 10n * E, after: { reserveMusd: 1000n * E, reserveBtc: 1n * E, totalSupply: 100n * E } } as never;
  const rest = [{ label: "Network fee", value: "0.00001 BTC" }];

  it("puts Below what you put in before Network fee", () => {
    const rows = lpDetailsRows(entryWorth(quote, 900n * E, 200n * E), rest);
    expect(rows.map((r) => r.label)).toEqual(["Below what you put in", "Network fee"]);
  });

  it("adds nothing without a gap or a worth", () => {
    expect(lpDetailsRows(entryWorth(quote, 900n * E, 180n * E), rest)).toEqual(rest);
    expect(lpDetailsRows(null, rest)).toEqual(rest);
  });
});

describe("planner precision (U18): MUSD at 2 dp in Details", () => {
  const E = 10n ** 18n;
  it("troveChangeRows reads MUSD to 2 dp", () => {
    const rows = troveChangeRows({
      trove: { debt: 1234_567_800_000_000_000_000n, collateral: E } as never,
      effect: { newDebt: 1334_567_800_000_000_000_000n, fee: 1_234_500_000_000_000_000n, newCr: null } as never,
      price: 1000n * E,
      mcr: 11n * E / 10n,
    });
    expect(rows[0].value).toBe("1,234.56 MUSD → 1,334.56 MUSD");
    expect(rows[0].sub).toBe("includes the 1.23 MUSD borrowing fee");
  });

  it("EntryPreviewCard reads MUSD to 2 dp", () => {
    const quote = { fee: 1_234_500_000_000_000_000n, musdToSwap: 500_126_000_000_000_000_000n, btcFromSwap: E / 100n } as never;
    const out = renderToStaticMarkup(createElement(EntryPreviewCard, { quote, feeBps: 10n, borrowFee: 1_234_500_000_000_000_000n }));
    expect(out).toContain("fee: 1.23 MUSD");
    expect(out).toContain("500.12 MUSD is swapped");
  });
});
