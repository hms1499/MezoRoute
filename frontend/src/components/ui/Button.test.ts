import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, ButtonContent, ButtonLink, buttonClass } from "./Button";

describe("button style roles", () => {
  it("keeps the filled landing alias aligned with primary", () => {
    expect(buttonClass("primary")).toContain("bg-accent text-onAccent");
    expect(buttonClass("night")).toContain("bg-accent text-onAccent");
    expect(buttonClass("night")).toContain("min-h-11");
  });

  it("keeps the outlined landing alias aligned with secondary geometry", () => {
    const secondary = buttonClass("secondary");
    const nightOutline = buttonClass("nightOutline");
    expect(secondary).toContain("ring-1 ring-inset");
    expect(nightOutline).toContain("ring-1 ring-inset");
    expect(secondary).toContain("min-h-11");
    expect(nightOutline).toContain("min-h-11");
    expect(nightOutline).toContain("ring-accent");
  });

  it("keeps the quiet landing alias aligned with ghost", () => {
    expect(buttonClass("ghost")).toContain("text-accent hover:bg-accent-soft");
    expect(buttonClass("nightGhost")).toContain("text-muted hover:text-ink");
    expect(buttonClass("nightGhost")).toContain("min-h-11");
  });

  it("keeps compact buttons at least 36 px tall", () => {
    expect(buttonClass("primary", "sm")).toContain("min-h-9");
    expect(buttonClass("nightOutline", "sm")).toContain("min-h-9");
  });
});

// U10: Morpho's button. The label rolls on hover; forward buttons carry an arrow in a circle.
const html = (el: ReactElement) => renderToStaticMarkup(el);

describe("button roll and arrow (U10)", () => {
  it("renders the label twice, the copy hidden from assistive tech", () => {
    const out = html(createElement(Button, null, "Deposit to LP"));
    expect(out.match(/Deposit to LP/g)).toHaveLength(2);
    expect(out).toContain('<span class="btn-label" aria-hidden="true">Deposit to LP</span>');
  });

  it("renders the arrow circle only when asked", () => {
    expect(html(createElement(Button, null, "Go"))).not.toContain("btn-circle");
    const out = html(createElement(Button, { arrow: true }, "Go"));
    expect(out.match(/btn-arrow/g)).toHaveLength(2);
    expect(out).toContain('class="btn-circle');
  });

  it("rolls links too", () => {
    const out = html(createElement(ButtonLink, { href: "/positions/", arrow: true }, "View positions"));
    expect(out.match(/View positions/g)).toHaveLength(2);
    expect(out).toContain("btn-circle");
  });

  it("keeps icon buttons to one child", () => {
    expect(html(createElement(Button, { size: "icon", "aria-label": "Theme" }, "x")).match(/>x</g)).toHaveLength(1);
  });

  it("never puts a circle on external links", () => {
    const out = html(createElement(ButtonLink, { href: "https://x.test", external: true, arrow: true }, "Mezo"));
    expect(out).not.toContain("btn-circle");
    expect(out.match(/Mezo/g)).toHaveLength(2);
  });

  it("presses on active", () => {
    expect(buttonClass()).toContain("motion-safe:active:scale-[0.97]");
  });

  it("gives plain anchors the same content", () => {
    const out = html(createElement("a", { href: "#simulator" }, createElement(ButtonContent, { arrow: true }, "Compare routes")));
    expect(out.match(/Compare routes/g)).toHaveLength(2);
    expect(out).toContain("btn-circle");
  });
});

describe("button CSS (U10)", () => {
  const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");
  it("rolls on hover only where hover exists, and never under reduced motion", () => {
    const hoverRules = css.split("\n").filter((line) => /\.btn-[a-z]+.*:hover|:hover.*\.btn-[a-z]+/.test(line));
    expect(hoverRules.length).toBeGreaterThan(0);
    const block = css.slice(css.indexOf("@media (hover: hover) and (prefers-reduced-motion: no-preference)"));
    expect(css.indexOf("@media (hover: hover) and (prefers-reduced-motion: no-preference)")).toBeGreaterThan(-1);
    for (const rule of hoverRules) expect(block).toContain(rule);
  });
});
