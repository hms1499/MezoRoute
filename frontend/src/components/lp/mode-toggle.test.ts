import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModeToggle } from "./ModeToggle";

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(ModeToggle, { walletKind: "eoa", hasTrove: true, mode: "deposit", onChange: () => undefined, ...props }));

describe("ModeToggle", () => {
  it("asks for a wallet before borrowing, even with a Trove", () => {
    const out = render({ connected: false });
    expect(out).toMatch(/Borrow &amp; Deploy<\/[^>]+>/);
    expect(out).toContain(" needs a connected wallet with a Trove.");
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Borrow &amp; Deploy<\/button>/);
  });

  it("keeps the connected rule", () => {
    expect(render({})).not.toContain("needs a connected wallet");
    expect(render({ hasTrove: false })).toContain("needs an open Trove");
  });
});
