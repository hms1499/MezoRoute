import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionCard } from "./ActionCard";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { Overview } from "./Overview";
import { ReceiveRow } from "./ReceiveRow";
import { TokenAmountInput } from "./TokenAmountInput";

// U11 §6.1: the amount field, the receive row, and the overview box of the flow cards.

const base = {
  id: "amount",
  label: "You deposit",
  amount: "",
  onAmount: () => undefined,
  token: "musd" as const,
  balance: 10n * 10n ** 18n,
  max: 10n * 10n ** 18n,
};
const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(TokenAmountInput, { ...base, ...props }));

describe("TokenAmountInput", () => {
  it("opens a token menu when two tokens are offered", () => {
    expect(render({ tokens: ["musd", "btc"], onToken: () => undefined })).toContain('aria-haspopup="menu"');
  });

  it("shows a typed amount grouped while the field is not focused (U18)", () => {
    expect(render({ amount: "1000" })).toContain('value="1,000"');
    expect(render({ amount: "1.2.3" })).toContain('value="1.2.3"');
  });

  it("shows a static chip for one token", () => {
    expect(render({})).not.toContain("aria-haspopup");
  });

  it("disables Max when there is no max", () => {
    expect(render({ max: null })).toMatch(/<button[^>]*disabled=""[^>]*>Max<\/button>/);
  });

  it("shows an error under the box", () => {
    const out = render({ error: "x" });
    expect(out).toContain("text-danger");
    expect(out).toContain(">x<");
  });

  it("ties the error to the input, so a screen reader hears why Review is off (U14 final review)", () => {
    const out = render({ error: "Amount exceeds your available MUSD." });
    expect(out).toMatch(/<input[^>]*aria-describedby="[^"]*\bamount-error\b[^"]*"/);
    expect(out).toMatch(/<p[^>]*id="amount-error"[^>]*role="alert"/);
  });

  it("keeps the input's decimal keyboard and its description", () => {
    const out = render({ note: "keeps gas" });
    expect(out).toMatch(/<input[^>]*inputMode="decimal"/);
    expect(out).toMatch(/<input[^>]*autoComplete="off"/);
    expect(out).toMatch(/<input[^>]*aria-describedby="amount-help amount-note"/);
    expect(out).toContain('id="amount-note"');
    expect(out).toContain('id="amount-help"');
    expect(out).toContain("keeps gas");
  });

  it("shows the balance", () => {
    expect(render({})).toContain("Balance 10");
  });

  it("asks the visitor to connect instead of showing a zero balance", () => {
    const out = render({ balance: null, max: null });
    expect(out).toContain("Connect to see balance");
    expect(out).not.toContain("Balance 0");
    // U13 follow-up: no Max before a wallet connects (it filled nothing and truncated the sentence beside it).
    expect(out).not.toContain(">Max<");
  });

  it("keeps Max while a balance is readable but Max is blocked", () => {
    expect(render({ balance: 10n, max: null })).toMatch(/<button[^>]*disabled=""[^>]*>Max<\/button>/);
  });  it("renders the percent presets in percent mode", () => {
    const out = render({ percent: { value: 50, presets: [25, 50, 75, 100], onPreset: () => undefined } });
    expect(out).toContain('role="radiogroup"');
    expect(out).toContain(">Max<");
  });

  it("labels the percent output", () => {
    const out = render({ percent: { value: 50, presets: [25, 50, 75, 100], onPreset: () => undefined } });
    expect(out).toMatch(/<label[^>]*id="amount-label"/);
    expect(out).toMatch(/<output[^>]*id="amount"[^>]*aria-labelledby="amount-label"/);
  });

  it("keeps the input's htmlFor", () => {
    expect(render({})).toMatch(/<label[^>]*for="amount"/);
  });
});

describe("ReceiveRow", () => {
  it("labels the row and shows the minimum", () => {
    const out = renderToStaticMarkup(createElement(ReceiveRow, { value: "1 LP", minimum: "Minimum 0.9 LP", icon: null }));
    expect(out).toContain("You receive");
    expect(out).toContain("1 LP");
    expect(out).toContain("Minimum 0.9 LP");
  });

  it("gives the minimum the sentence size", () => {
    const out = renderToStaticMarkup(createElement(ReceiveRow, { value: "1 LP", minimum: "At least 0.9 LP", icon: null }));
    expect(out).toMatch(/<p class="mt-0\.5 text-sm text-muted">At least 0\.9 LP<\/p>/);
  });
});

describe("ActionCard", () => {
  it("left-aligns the risk line at the sentence size", () => {
    const out = renderToStaticMarkup(
      createElement(ActionCard, { icon: null, title: "MUSD / BTC", risk: "Impermanent loss and MEZO price risk" }),
    );
    expect(out).toMatch(/<p class="text-left text-sm text-muted">/);
    expect(out).not.toContain("text-center text-xs");
  });
});

describe("Overview", () => {
  it("renders one dt/dd pair per row", () => {
    const out = renderToStaticMarkup(
      createElement(Overview, {
        rows: [
          { label: "Fee", value: "0.01 MUSD" },
          { label: "BTC exposure", value: "+0.1 BTC", tone: "btc" },
          { label: "Price impact", value: "0.3%", sub: "small" },
        ],
      }),
    );
    expect(out.match(/<dt/g)).toHaveLength(3);
    expect(out.match(/<dd/g)).toHaveLength(3);
    expect(out).toContain("text-btc");
  });
});

describe("Overview columns", () => {
  it("keeps one group at the card's full width even when two columns are asked for (the Trove Confirm)", () => {
    const out = renderToStaticMarkup(createElement(Overview, { columns: 2, rows: [{ label: "Debt", value: "1" }, { label: "Collateral", value: "2" }] }));
    expect(out).not.toContain("lg:grid-cols-2");
  });

  it("stacks You pay and Terms on the left and You receive on the right from lg, in reading order below it", () => {
    const out = renderToStaticMarkup(
      createElement(Overview, {
        columns: 2,
        rows: [
          { label: "You deposit", value: "1", group: "You pay" },
          { label: "LP", value: "2", group: "You receive" },
          { label: "Slippage", value: "1%", group: "Terms" },
        ],
      }),
    );
    const columns = out.split('class="contents lg:block"').slice(1);
    expect(columns).toHaveLength(2);
    expect(columns[0]).toContain(">You pay<");
    expect(columns[0]).toContain(">Terms<");
    expect(columns[0]).not.toContain(">You receive<");
    expect(columns[1]).toContain(">You receive<");
    expect(out).toMatch(/order-1[^>]*><p[^>]*>You pay/);
    expect(out).toMatch(/order-2[^>]*><p[^>]*>You receive/);
    expect(out).toMatch(/order-3[^>]*><p[^>]*>Terms/);
  });

  it("lays two groups side by side from lg", () => {
    const out = renderToStaticMarkup(
      createElement(Overview, { columns: 2, rows: [{ label: "You deposit", value: "1", group: "You pay" }, { label: "LP", value: "2", group: "You receive" }] }),
    );
    expect(out).toContain("lg:grid-cols-2");
  });
});

// U14 B3: a heavy price impact reads amber before it blocks; a field block's recoveries stay without its message.
describe("Overview warning tone", () => {
  it("renders a warning value in the warning ink", () => {
    const out = renderToStaticMarkup(createElement(Overview, { rows: [{ label: "Price impact", value: "2%", tone: "warning" }] }));
    expect(out).toMatch(/<dd class="[^"]*\btext-warning-ink\b[^"]*"><span[^>]*><svg.*?<\/svg><span>2%/);
  });
});

describe("BlockNotice without a message", () => {
  it("keeps the recoveries when the field says the message", () => {
    const out = renderToStaticMarkup(
      createElement(BlockNotice, { block: { outcome: null }, actions: [{ label: "Use my balance (20 MUSD)", onClick: () => undefined }] }),
    );
    expect(out).toContain("Use my balance (20 MUSD)");
    expect(out).not.toContain("text-danger");
  });

  it("renders nothing with neither a message nor a recovery", () => {
    expect(renderToStaticMarkup(createElement(BlockNotice, { block: { outcome: null } }))).toBe("");
  });
});
