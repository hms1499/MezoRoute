import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionCard } from "./ActionCard";
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
