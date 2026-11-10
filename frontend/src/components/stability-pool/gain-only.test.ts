import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpGainOnlyCard } from "./SpGainOnlyCard";

// U14 final review: with no deposit and a BTC gain, a blocked Claim says why instead of sitting disabled and silent.

const base = { gain: 10n ** 12n, busy: false, pending: null, onClaim: () => undefined };
const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(SpGainOnlyCard, { ...base, ...props }));

describe("SpGainOnlyCard", () => {
  it("offers Claim as the primary when nothing blocks it", () => {
    const out = render({ claimBlock: null });
    expect(out).toContain("Claim BTC gain");
    expect(out).not.toContain('disabled=""');
    expect(out).not.toContain('role="status"');
  });

  it("says why Claim is disabled", () => {
    const out = render({ claimBlock: { reason: "needs-gas", outcome: { kind: "insufficient-gas", message: "You need a little BTC for gas.", recovery: [] } } });
    expect(out).toMatch(/<button[^>]*disabled=""/);
    expect(out).toContain("You need a little BTC for gas.");
  });
});
