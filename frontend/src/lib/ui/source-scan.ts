import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// U11: the source walk the design-system guards share (radius, spacing, controls, shadows). Test-only: nothing in
// the app imports it.

/** A guard rule: its name, and a pattern or predicate a source line breaks; `cssOnly` rules apply to .css files only. */
export type GuardRule = [name: string, test: RegExp | ((line: string) => boolean), cssOnly?: boolean];

const SRC = join(__dirname, "../..");

/** Every .ts, .tsx, and .css file under `src/`, test files excluded, as paths relative to `src/`. */
export function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [relative(SRC, path)] : [];
  });
}

/** The names of the rules one line breaks. */
export function lineOffences(rules: GuardRule[], line: string, css: boolean): string[] {
  return rules
    .filter(([, test, cssOnly]) => (!cssOnly || css) && (typeof test === "function" ? test(line) : test.test(line)))
    .map(([name]) => name);
}

/** Every rule break in `src/`, as `file:line: rule: text`; `skip` drops whole files, `allow` single lines. */
export function scanSource(rules: GuardRule[], opts: { skip?: string[]; allow?: (file: string, line: string) => boolean } = {}): string[] {
  return sourceFiles()
    .filter((file) => !opts.skip?.includes(file))
    .flatMap((file) =>
      readFileSync(join(SRC, file), "utf8")
        .split("\n")
        .flatMap((line, index) => {
          if (opts.allow?.(file, line)) return [];
          return lineOffences(rules, line, file.endsWith(".css")).map((name) => `${file}:${index + 1}: ${name}: ${line.trim()}`);
        }),
    );
}
