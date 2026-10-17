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
      headline: ["24px", { lineHeight: "32px", fontWeight: "600", letterSpacing: "-0.025em" }],
      title: ["28px", { lineHeight: "34px", fontWeight: "600", letterSpacing: "-0.025em" }],
      figure: ["28px", { lineHeight: "32px", fontWeight: "500", letterSpacing: "-0.025em" }],
      display: ["40px", { lineHeight: "48px", fontWeight: "700", letterSpacing: "-0.025em" }],
      "display-lg": ["48px", { lineHeight: "52px", fontWeight: "700", letterSpacing: "-0.025em" }],
    });
  });

  it("never goes below 12 px", () => {
    for (const [size] of Object.values(fontSize)) expect(parseFloat(size)).toBeGreaterThanOrEqual(12);
    expect(CHART_FONT_PX).toBe(12);
  });

  it("uses weight 700 only for the display tokens", () => {
    for (const [key, [, meta]] of Object.entries(fontSize)) {
      const weight = "fontWeight" in meta ? meta.fontWeight : undefined;
      if (weight === undefined) continue;
      expect(DISPLAY.has(key) ? ["700"] : ["400", "500", "600"]).toContain(weight);
    }
  });
});

// The source scan: every size, line height, and weight must come from the scale.
const SRC = join(__dirname, "../..");
const RULES: [name: string, pattern: RegExp, cssOnly?: boolean][] = [
  ["arbitrary size", /\btext-\[\d/],
  ["removed size", /\btext-(lg|[2-9]xl)\b/],
  ["line height", /\bleading-(?!relaxed\b)[\w[]/],
  ["weight", /\bfont-(thin|extralight|light|bold|extrabold|black)\b/],
  ["css size", /^\s*(font-size|line-height)\s*:/, true],
  ["svg size", /fontSize=\{\d/],
];

/** Files still on the old sizes; Task 3 of the U6 plan migrates them and deletes this set. */
const PENDING: ReadonlySet<string> = new Set([
  "app/globals.css",
  "components/landing/Hero.tsx",
  "components/landing/HowItWorks.tsx",
  "components/landing/TrustRow.tsx",
  "components/landing/RouteLanes.tsx",
  "components/landing/FinalCta.tsx",
  "components/landing/LiveStrip.tsx",
  "components/landing/Simulator.tsx",
  "components/chart/BtcMoveChart.tsx",
]);

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
    expect(offences("fontSize={10}", false)).toEqual(["svg size"]);
    expect(offences("leading-relaxed text-sm text-xl font-semibold text-headline", false)).toEqual([]);
  });

  it("finds no off-scale type outside PENDING", () => {
    const hits = files
      .filter((file) => !PENDING.has(file))
      .flatMap((file) =>
        readFileSync(join(SRC, file), "utf8")
          .split("\n")
          .flatMap((line, i) => offences(line, file.endsWith(".css")).map((rule) => `${file}:${i + 1} ${rule}`)),
      );
    expect(hits).toEqual([]);
  });
});
