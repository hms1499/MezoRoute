import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HowItWorks } from "./HowItWorks";

describe("HowItWorks", () => {
  const out = renderToStaticMarkup(createElement(HowItWorks));

  it("walks plan, sign, manage (U16)", () => {
    expect(out).toContain("Plan, sign, manage");
    for (const title of ["Plan", "Sign", "Manage"]) expect(out).toContain(`${title}</p>`);
    expect(out).toContain("Both routes for one amount. No wallet needed.");
    expect(out).toContain("Exact amounts from one block, one transaction in.");
    expect(out).toContain("Stake, claim, exit, or unwind your Trove.");
  });

  it("marks each step with an icon instead of a number (U16)", () => {
    expect(out.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(3);
    expect(out).not.toMatch(/>\s*[123]\s*</);
  });

  it("does not promise one transaction out: staked LP unstakes first", () => {
    expect(out).not.toContain("each way");
    expect(out).not.toContain("one transaction out");
  });
});
