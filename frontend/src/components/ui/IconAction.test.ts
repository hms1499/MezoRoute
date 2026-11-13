import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CopyAction, IconAction, RefreshAction } from "./IconAction";
import { RotateCw } from "lucide-react";

// U21: icon-only actions keep an accessible name (aria-label), hide the glyph, and show the same word as a tooltip on
// hover and keyboard focus (never the only label: the tooltip repeats the name, hidden from assistive tech).

describe("IconAction", () => {
  it("names the action, hides the glyph, and repeats the name as a hover/focus tooltip", () => {
    const html = renderToStaticMarkup(createElement(IconAction, { label: "Refresh", icon: RotateCw, onClick: () => undefined }));
    expect(html).toMatch(/<button[^>]*type="button"[^>]*aria-label="Refresh"/);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>Refresh<\/span>/);
    expect(html).toMatch(/group-hover:block/);
    expect(html).toMatch(/group-focus-visible:block/);
    // A hit area, so the 14 px glyph still meets the 24 px (44 px on touch) target.
    expect(html).toMatch(/class="[^"]*\bhit\b/);
  });

  it("marks a busy action and spins only under motion-safe", () => {
    const html = renderToStaticMarkup(createElement(IconAction, { label: "Refresh", icon: RotateCw, onClick: () => undefined, busy: true }));
    expect(html).toMatch(/aria-busy="true"/);
    expect(html).toMatch(/motion-safe:animate-spin/);
  });
});

describe("RefreshAction and CopyAction", () => {
  it("refresh is named Refresh", () => {
    expect(renderToStaticMarkup(createElement(RefreshAction, { onRefresh: () => undefined }))).toMatch(/aria-label="Refresh"/);
  });

  it("copy names what it copies and keeps a polite live region for the confirmation", () => {
    const html = renderToStaticMarkup(createElement(CopyAction, { value: "0xabc", what: "address" }));
    expect(html).toMatch(/aria-label="Copy address"/);
    expect(html).toMatch(/aria-live="polite"/);
  });
});
