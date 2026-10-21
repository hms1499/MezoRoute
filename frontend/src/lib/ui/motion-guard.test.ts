import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// U10 (spec 2026-10-21-u10-motion-system-landing-design.md): one easing curve and three durations, defined once in
// motion.ts. Components use `ease-smooth`/`duration-fast|base|slow` (or the Tailwind defaults), never their own.

const SRC = join(__dirname, "../..");
/** The tokens themselves; the only file allowed to write curves and durations as values. */
const SOURCE_OF_TRUTH = "lib/ui/motion.ts";
const RULES: [name: string, pattern: RegExp, cssOnly?: boolean][] = [
  ["easing class", /\bease-(in|out|in-out)\b/],
  ["numeric duration", /\bduration-(\d|\[)/],
  ["raw curve", /cubic-bezier\(/],
  // A CSS keyword easing (`ease`, `ease-out`…); `var(--ease-smooth)` and `ease-smooth` are the tokens.
  ["css easing keyword", /(?<![-\w])ease(-in-out|-in|-out)?(?![-\w])/, true],
  ["removed animation", /\banimate-(shimmer|pulse)\b/],
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

describe("motion usage in source", () => {
  const files = sourceFiles();

  it("scans components and CSS", () => {
    expect(files).toContain("app/globals.css");
    expect(files).toContain("components/ui/Button.tsx");
  });

  it("catches each rule", () => {
    expect(offences("transition-colors duration-150 ease-out", false)).toEqual(["easing class", "numeric duration"]);
    expect(offences("duration-[250ms]", false)).toEqual(["numeric duration"]);
    expect(offences("transform 0.4s cubic-bezier(0.2, 0.7, 0.2, 1)", false)).toEqual(["raw curve"]);
    expect(offences("      border-color var(--landing-motion-control) ease,", true)).toEqual(["css easing keyword"]);
    expect(offences("    animation: landing-ping 1s ease-out infinite;", true)).toContain("css easing keyword");
    expect(offences("motion-safe:animate-shimmer", false)).toEqual(["removed animation"]);
    expect(offences("motion-safe:animate-pulse", false)).toEqual(["removed animation"]);
  });

  it("lets the tokens and prose through", () => {
    for (const line of [
      "transition-colors duration-fast ease-smooth ease-linear duration-tick",
      "    transition: opacity var(--motion-slow) var(--ease-smooth);",
      "    animation: motif-flow 4s linear infinite;",
      "  @apply ease-smooth;",
    ])
      expect(offences(line, true), line).toEqual([]);
    // Prose in TypeScript is not CSS.
    expect(offences("/** A bigint that eases to `target`, ease in mind. */", false)).toEqual([]);
  });

  it("finds no off-token motion", () => {
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

describe("loading motion (U10)", () => {
  const css = readFileSync(join(SRC, "app/globals.css"), "utf8");
  it("settles content only without reduced motion", () => {
    const media = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    const rule = css.indexOf(".settle {");
    expect(rule).toBeGreaterThan(media);
    expect(css.slice(media, rule)).not.toMatch(/\n\}\n/);
  });

  it("breathes instead of shimmering", () => {
    const skeleton = readFileSync(join(SRC, "components/ui/Skeleton.tsx"), "utf8");
    expect(skeleton).toContain("motion-safe:animate-breathe");
    expect(skeleton).not.toContain("bg-gradient");
  });
});
