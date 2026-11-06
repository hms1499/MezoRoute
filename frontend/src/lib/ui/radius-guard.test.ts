import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lineOffences, scanSource, type GuardRule } from "./source-scan";
import { radius } from "./tokens";

// U11 §5.3: one radius scale; Tailwind knows only these, and nothing writes another radius.

const SCALE = new Set(["none", "tip", "inset", "card", "pill", "full"]);
const SIDE = /^(?:tl|tr|bl|br|ss|se|es|ee|t|r|b|l|s|e)-/;

/** A Tailwind radius class off the scale. A bare `rounded` counts only inside a string, so prose ("rounded up") passes. */
function offScaleClass(line: string): boolean {
  for (const match of line.matchAll(/(?<![\w-])rounded(?:-([A-Za-z0-9[\].-]+))?(?![\w-])/g)) {
    const suffix = match[1];
    if (suffix === undefined) {
      const before = line.slice(0, match.index);
      if ((before.split('"').length - 1) % 2 === 1 || (before.split("`").length - 1) % 2 === 1) return true;
      continue;
    }
    if (!SCALE.has(suffix.replace(SIDE, ""))) return true;
  }
  return false;
}

const RULES: GuardRule[] = [
  ["radius", offScaleClass],
  // Literal CSS radii; the landing's variables and the pill value pass.
  ["radius", /border-radius:\s*(?!var\(--)(?!9999px)[\d.]/, true],
];

/** The only literal radius outside the scale: the landing's framed grid (U10). */
const EXCEPTIONS: Record<string, RegExp> = { "app/globals.css": /^\s*border-radius: 0\.25rem;/ };

const offences = (line: string, css = false) => lineOffences(RULES, line, css);

describe("radius tokens", () => {
  it("is exactly the spec's radius scale", () => {
    expect(radius).toEqual({ none: "0px", tip: "8px", inset: "12px", card: "16px", pill: "9999px", full: "9999px" });
  });

  it("keeps the landing's radius variables on the scale", () => {
    const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");
    expect(css).toMatch(/--landing-radius-panel: 1rem;/); // card
    expect(css).toMatch(/--landing-radius-control: 0\.75rem;/); // inset
    expect(css).toMatch(/--landing-radius-pill: 9999px;/);
  });
});

describe("radius usage in source", () => {
  it("catches off-scale radii", () => {
    for (const line of ["rounded-xl", "rounded-2xl", "rounded-lg", "rounded-sm", 'className="rounded px-1"', "rounded-[3px]", "rounded-t-lg"]) {
      expect(offences(line), line).toEqual(["radius"]);
    }
    expect(offences("  border-radius: 6px;", true)).toEqual(["radius"]);
  });

  it("lets the scale and prose through", () => {
    for (const line of [
      "rounded-card rounded-inset rounded-pill rounded-full rounded-tip rounded-none",
      "rounded-t-card",
      "/** a / b rounded up, for non-negative a. */",
      "// whole seconds, rounded up",
      "all values rounded down (the chart's data)",
    ]) {
      expect(offences(line), line).toEqual([]);
    }
    expect(offences("  border-radius: var(--landing-radius-panel);", true)).toEqual([]);
    expect(offences("  border-radius: 9999px;", true)).toEqual([]);
  });

  it("finds no off-scale radius", () => {
    const hits = scanSource(RULES, { skip: ["lib/ui/tokens.ts"], allow: (file, line) => EXCEPTIONS[file]?.test(line) ?? false });
    expect(hits).toEqual([]);
  });
});
