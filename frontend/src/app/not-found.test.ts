import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotFound, { metadata } from "./not-found";

// U14 B4: an unknown address shows a MezoRoute page (the shell comes from the root layout), one h1, and ways back.
describe("NotFound", () => {
  const out = renderToStaticMarkup(createElement(NotFound));

  it("has one h1 and says what happened", () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*>Page not found<\/h1>/);
    expect(out).toContain("This address is not part of MezoRoute. Check the link, or go to one of these pages.");
  });

  it("links the dashboard (the one primary) and Positions", () => {
    expect(out).toMatch(/href="\/"[^>]*>[\s\S]*Open the dashboard/);
    expect(out).toMatch(/href="\/positions\/?"[\s\S]*Positions/);
    expect((out.match(/<a\b[^>]*class="[^"]*\bbg-accent(?![-\w/])/g) ?? []).length).toBe(1);
  });

  it("is titled Page not found", () => {
    expect(metadata.title).toBe("Page not found");
  });
});
