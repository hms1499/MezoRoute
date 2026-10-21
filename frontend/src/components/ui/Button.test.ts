import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type FunctionComponent, type ReactElement } from "react";
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
const html = (element: ReactElement) => renderToStaticMarkup(element);
/** createElement for components whose props require children, with the children passed the usual way. */
const el = (type: unknown, props: Record<string, unknown> | null, child: string) =>
  createElement(type as FunctionComponent<Record<string, unknown>>, props, child);

describe("button roll and arrow (U10)", () => {
  it("renders the label twice, the copy hidden from assistive tech", () => {
    const out = html(el(Button, null, "Deposit to LP"));
    expect(out.match(/Deposit to LP/g)).toHaveLength(2);
    expect(out).toContain('<span class="btn-label" aria-hidden="true">Deposit to LP</span>');
  });

  it("renders the arrow circle only when asked", () => {
    expect(html(el(Button, null, "Go"))).not.toContain("btn-circle");
    const out = html(el(Button, { arrow: true }, "Go"));
    expect(out.match(/btn-arrow/g)).toHaveLength(2);
    expect(out).toContain('class="btn-circle');
  });

  it("rolls links too", () => {
    const out = html(el(ButtonLink, { href: "/positions/", arrow: true }, "View positions"));
    expect(out.match(/View positions/g)).toHaveLength(2);
    expect(out).toContain("btn-circle");
  });

  it("keeps icon buttons to one child", () => {
    expect(html(el(Button, { size: "icon", "aria-label": "Theme" }, "x")).match(/>x</g)).toHaveLength(1);
  });

  it("never puts a circle on external links", () => {
    const out = html(el(ButtonLink, { href: "https://x.test", external: true, arrow: true }, "Mezo"));
    expect(out).not.toContain("btn-circle");
    expect(out.match(/Mezo/g)).toHaveLength(2);
  });

  it("presses on active", () => {
    expect(buttonClass()).toContain("motion-safe:active:scale-[0.97]");
  });

  it("gives plain anchors the same content", () => {
    const out = html(createElement("a", { href: "#simulator" }, el(ButtonContent, { arrow: true }, "Compare routes")));
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

describe("pending button (U10)", () => {
  it("keeps its label as the accessible name and shows the status beside it", () => {
    const out = html(el(Button, { pending: "wallet" }, "Deposit to LP"));
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('aria-disabled="true"');
    expect(out).toContain('data-pending="wallet"');
    expect(out).toContain('<span class="btn-label">Deposit to LP</span>');
    expect(out).toMatch(/<span class="btn-status[^"]*" aria-hidden="true">Check your wallet…<\/span>/);
    expect(out).toContain("dot-wave");
  });

  it("shows a check when done, no longer busy", () => {
    const out = html(el(Button, { pending: "done" }, "Approve MUSD"));
    expect(out).not.toContain("aria-busy");
    expect(out).toContain("lucide-check");
    expect(out).toContain(">Done</span>");
  });

  it("keeps the idle label while merely busy", () => {
    const out = html(el(Button, { pending: "busy" }, "Switch network"));
    expect(out).not.toContain("btn-status");
    expect(out).toContain("dot-wave");
  });

  it("brings a circle to a button that has none", () => {
    expect(html(el(Button, { pending: "wallet" }, "Claim"))).toContain("btn-circle");
    expect(html(el(Button, null, "Claim"))).not.toContain("btn-circle");
  });

  it("stays a plain button when nothing is pending", () => {
    const out = html(el(Button, { pending: null }, "Claim"));
    expect(out).not.toContain("data-pending=");
    expect(out).not.toContain('aria-busy="');
    expect(out).not.toContain('aria-disabled="');
  });
});

describe("icon sizes in buttons (U10 §8)", () => {
  it("sizes the arrow to the button", () => {
    expect(html(el(Button, { arrow: true, size: "sm" }, "Go")).match(/btn-arrow h-3\.5 w-3\.5/g)).toHaveLength(2);
    expect(html(el(Button, { arrow: true }, "Go")).match(/btn-arrow h-4 w-4/g)).toHaveLength(2);
  });

  it("sizes the external-link glyph to the button", () => {
    expect(html(el(ButtonLink, { href: "https://x.test", external: true }, "Mezo"))).toContain("lucide-external-link h-4 w-4");
    expect(html(el(ButtonLink, { href: "https://x.test", external: true, size: "sm" }, "Mezo"))).toContain("lucide-external-link h-3.5 w-3.5");
  });
});

describe("pending wins over disabled (final review, U10)", () => {
  it("keeps a pending button in full colour even when its caller also disables it", () => {
    const out = html(el(Button, { pending: "wallet", disabled: true }, "Withdraw"));
    expect(out).not.toMatch(/ disabled=""/);
    expect(out).toContain('aria-disabled="true"');
  });
});

describe("inert buttons do not press (U10 minor)", () => {
  it("holds a pending or disabled-link button still on :active", () => {
    expect(buttonClass()).toContain("aria-disabled:active:scale-100");
  });
});
