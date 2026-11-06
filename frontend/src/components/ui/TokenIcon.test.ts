import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PairIcon, TokenIcon } from "./TokenIcon";

// U11 §5.8: token icons are the user's files, 16 / 20 / 24 px, cropped to a circle (MEZO's file is square).

describe("TokenIcon", () => {
  it("renders the token's file at its size, decorative by default", () => {
    const out = renderToStaticMarkup(createElement(TokenIcon, { token: "btc", size: 20 }));
    expect(out).toContain('src="/tokens/btc.png"');
    expect(out).toContain('width="20"');
    expect(out).toContain('height="20"');
    expect(out).toContain('alt=""');
    expect(out).toContain("rounded-pill");
    expect(out).toContain("overflow-hidden");
  });

  it("names the token when no text label sits beside it", () => {
    expect(renderToStaticMarkup(createElement(TokenIcon, { token: "mezo", size: 16, label: "MEZO" }))).toContain('alt="MEZO"');
  });

  it("overlaps a pair, the second ringed in the surface colour", () => {
    const out = renderToStaticMarkup(createElement(PairIcon, { tokens: ["musd", "btc"], size: 24 }));
    expect(out.match(/<img/g)).toHaveLength(2);
    expect(out).toContain('src="/tokens/musd.png"');
    expect(out).toContain("ring-2 ring-surface");
  });
});
