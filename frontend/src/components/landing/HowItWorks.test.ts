import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HowItWorks } from "./HowItWorks";

describe("HowItWorks", () => {
  it("does not promise one transaction out: staked LP unstakes first", () => {
    const out = renderToStaticMarkup(createElement(HowItWorks));
    expect(out).not.toContain("each way");
    expect(out).toContain("One transaction in after any approval your wallet needs; unstake if staked, then exit to MUSD.");
  });
});
