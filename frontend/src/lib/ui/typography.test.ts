import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CHART_FONT_PX, fontSize } from "./tokens";

// U6 (spec 2026-10-17-u6-type-scale-design.md): one type scale, defined once in tokens.ts.

const DISPLAY = new Set(["display", "display-lg"]);

describe("type tokens", () => {
  it("is exactly the spec's scale", () => {
    expect(fontSize).toEqual({
      xs: ["12px", { lineHeight: "16px" }],
      sm: ["14px", { lineHeight: "20px" }],
      base: ["16px", { lineHeight: "24px" }],
      xl: ["20px", { lineHeight: "28px" }],
      headline: [
        "24px",
        { lineHeight: "32px", fontWeight: "600", letterSpacing: "-0.025em" },
      ],
      title: [
        "28px",
        { lineHeight: "34px", fontWeight: "600", letterSpacing: "-0.025em" },
      ],
      figure: [
        "28px",
        { lineHeight: "32px", fontWeight: "500", letterSpacing: "-0.025em" },
      ],
      // U10: the landing's display type is light, as on morpho.org.
      display: [
        "40px",
        { lineHeight: "48px", fontWeight: "300", letterSpacing: "-0.02em" },
      ],
      "display-lg": [
        "48px",
        { lineHeight: "52px", fontWeight: "300", letterSpacing: "-0.02em" },
      ],
    });
  });

  it("never goes below 12 px", () => {
    for (const [size] of Object.values(fontSize)) expect(parseFloat(size)).toBeGreaterThanOrEqual(12);
    expect(CHART_FONT_PX).toBe(12);
  });

  it("uses weight 300 only for the display tokens", () => {
    for (const [key, [, meta]] of Object.entries(fontSize)) {
      const weight = "fontWeight" in meta ? meta.fontWeight : undefined;
      if (weight === undefined) continue;
      expect(DISPLAY.has(key) ? ["300"] : ["400", "500", "600"]).toContain(weight);
    }
  });
});

// The source scan: every size, line height, and weight must come from the scale.
const SRC = join(__dirname, "../..");
/** The scale itself; the only file allowed to write sizes, line heights, and weights as values. */
const SOURCE_OF_TRUTH = "lib/ui/tokens.ts";
const SCALE = Object.keys(fontSize).join("|");
const RULES: [name: string, pattern: RegExp, cssOnly?: boolean][] = [
  // Any arbitrary text value except a colour (`text-[#…]`, `text-[color:…]`).
  ["arbitrary size", /\btext-\[(?!#|color:)/],
  ["removed size", /\btext-(lg|[2-9]xl)\b/],
  ["line height", /\bleading-(?!relaxed\b)[\w[]/],
  // Tailwind's size/line-height shorthand (`text-sm/6`); colour opacity (`text-muted/60`) is not a scale key.
  ["line height", new RegExp(`\\btext-(${SCALE})/`)],
  ["weight", /\bfont-(thin|extralight|light|bold|extrabold|black)\b/],
  ["arbitrary property", /\[(font|font-size|line-height|font-weight):|\bfont-\[/],
  // SVG attributes (`fontSize={10}`, `fontSize="10"`) and React style objects; chart text uses CHART_FONT_PX.
  ["inline size", /\b(fontSize|lineHeight|fontWeight)\s*(=\s*["{]\s*["']?\d|:\s*["']?\d)/],
  ["css size", /(^|[{;\s])(font|font-size|line-height|font-weight)\s*:/, true],
];

function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [relative(SRC, path)] : [];
  });
}

/** The rules a line breaks, by name. */
function offences(line: string, css: boolean): string[] {
  return RULES.filter(([, pattern, cssOnly]) => (!cssOnly || css) && pattern.test(line)).map(([name]) => name);
}

describe("type usage in source", () => {
  const files = sourceFiles();

  it("scans .ts files too", () => {
    expect(files).toContain("lib/ui/tokens.ts");
    expect(files).not.toContain("lib/ui/typography.test.ts");
  });

  it("catches each rule", () => {
    expect(offences('className="text-[13px]"', false)).toEqual(["arbitrary size"]);
    expect(offences("text-3xl", false)).toEqual(["removed size"]);
    expect(offences("text-lg", false)).toEqual(["removed size"]);
    expect(offences("leading-snug", false)).toEqual(["line height"]);
    expect(offences("leading-[34px]", false)).toEqual(["line height"]);
    expect(offences("font-bold", false)).toEqual(["weight"]);
    expect(offences("  font-size: 1rem;", true)).toEqual(["css size"]);
    expect(offences("fontSize={10}", false)).toEqual(["inline size"]);
  });

  // Final review of U6: forms the first rules let through.
  it("catches line heights, sizes, and weights written any other way", () => {
    for (const line of ["text-sm/6", "text-xl/7", "text-sm/[18px]", "text-display-lg/none"]) expect(offences(line, false), line).toContain("line height");
    for (const line of ["text-[.8rem]", "text-[length:13px]", "text-[var(--x)]"]) expect(offences(line, false), line).toContain("arbitrary size");
    for (const line of ["[font-size:13px]", "[line-height:1.1]", "[font-weight:700]", "font-[700]"]) expect(offences(line, false), line).toContain("arbitrary property");
    for (const line of ["style={{ fontSize: 13 }}", 'fontSize="10"', "lineHeight: 1.2,", 'fontWeight: "700"']) expect(offences(line, false), line).toContain("inline size");
    for (const line of [".a { font-size: 12px }", "  font: 600 14px/20px Inter;", "  font-weight: 700;"]) expect(offences(line, true), line).toContain("css size");
  });

  it("lets the scale, colours, and prose through", () => {
    for (const line of [
      "leading-relaxed text-sm text-xl font-semibold text-headline",
      "text-muted/60 text-accent text-night-ink text-right [text-wrap:balance]",
      "fontSize={CHART_FONT_PX}",
      "  font-variant-numeric: tabular-nums;",
      "  @apply text-base font-semibold text-ink;",
    ])
      expect(offences(line, line.startsWith("  ")), line).toEqual([]);
  });

  it("finds no off-scale type", () => {
    const hits = files
      .filter((file) => file !== SOURCE_OF_TRUTH)
      .flatMap((file) =>
        readFileSync(join(SRC, file), "utf8")
          .split("\n")
          .flatMap((line, i) => offences(line, file.endsWith(".css")).map((rule) => `${file}:${i + 1} ${rule}`)),
      );
    expect(hits).toEqual([]);
  });
});

// U10 §8: weights have roles. Headings are 600 (or a size token that carries its weight); row headers are 400.
describe("weight roles (U10 §8)", () => {
  const files = sourceFiles().filter((file) => file.endsWith(".tsx"));
  const openings = (pattern: RegExp) =>
    files.flatMap((file) => {
      const source = readFileSync(join(SRC, file), "utf8");
      return [...source.matchAll(pattern)].map((match) => ({ file, tag: match[0], line: source.slice(0, match.index).split("\n").length }));
    });

  it("sets every h1–h3 at 600", () => {
    const hits = openings(/<h[1-3]\b[^>]*>/g)
      .filter(({ tag }) => !/\bfont-semibold\b|\btext-(headline|title|display|display-lg)\b/.test(tag))
      .map(({ file, line }) => `${file}:${line}`);
    expect(hits).toEqual([]);
  });

  it("sets every row header at 400", () => {
    const hits = openings(/<th\b[^>]*scope="row"[^>]*>/g)
      .filter(({ tag }) => !/\bfont-normal\b/.test(tag))
      .map(({ file, line }) => `${file}:${line}`);
    expect(hits).toEqual([]);
  });
});
