import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTROL } from "./tokens";
import { scanSource, sourceFiles } from "./source-scan";

// U11 §5.4: three control heights, and every target at least 24 px (44 px below 768 px) through `.hit`.

const SRC = join(__dirname, "../..");
const read = (file: string) => readFileSync(join(SRC, file), "utf8");

/** Buttons whose size a caller overrides from outside: none. */
const OUTSIDE_SIZING_EXCEPTIONS = new Set<string>();
const SIZING = /(?<![\w-])(?:[\w-]+:)?(?:min-h-|h-\d|px-|py-|p-\d|pl-|pr-|text-(?:xs|sm|base)\b)/;

/** Each `<Button …>`/`<ButtonLink …>` opening tag's `className` value, read with brace depth so `onClick={() => go()}`
 *  (whose `>` ends a naive `[^>]*` scan) does not hide a later `className`. */
function buttonClassNames(source: string): string[] {
  const out: string[] = [];
  for (const start of source.matchAll(/<(?:Button|ButtonLink)(?![\w.])/g)) {
    let depth = 0;
    let quote: string | null = null;
    let end = start.index + start[0].length;
    for (; end < source.length; end++) {
      const ch = source[end];
      if (quote) {
        if (ch === quote && source[end - 1] !== "\\") quote = null;
      } else if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) break;
    }
    const tag = source.slice(start.index, end);
    const at = tag.search(/\sclassName=/);
    if (at < 0) continue;
    const value = tag.slice(at).replace(/^\s*className=/, "");
    if (value.startsWith('"')) out.push(value.slice(0, value.indexOf('"', 1) + 1));
    else if (value.startsWith("{")) {
      let d = 0;
      let i = 0;
      for (; i < value.length; i++) {
        if (value[i] === "{") d++;
        else if (value[i] === "}" && --d === 0) break;
      }
      out.push(value.slice(0, i + 1));
    }
  }
  return out;
}

describe("control sizes", () => {
  it("reads className past an arrow function in the same tag", () => {
    expect(buttonClassNames('<Button onClick={() => go()} className="px-2 min-h-12">Go</Button>')).toEqual(['"px-2 min-h-12"']);
    expect(buttonClassNames("<ButtonLink href={x} className={cx(a, \"py-1\")}>Go</ButtonLink>")).toEqual(['{cx(a, "py-1")}']);
    expect(buttonClassNames('<ButtonContent className="px-2" />')).toEqual([]);
  });

  it("is the spec's control table", () => {
    expect(CONTROL).toEqual({
      lg: { h: 44, px: 20, text: "sm" },
      md: { h: 36, px: 16, text: "sm" },
      sm: { h: 28, px: 12, text: "xs" },
      icon: { h: 36, w: 36 },
    });
  });

  it("no outside sizing on buttons", () => {
    const hits: string[] = [];
    for (const file of sourceFiles().filter((f) => f.endsWith(".tsx") && !OUTSIDE_SIZING_EXCEPTIONS.has(f))) {
      const source = read(file);
      for (const value of buttonClassNames(source)) {
        if (SIZING.test(value)) hits.push(`${file}: ${value.replace(/\s+/g, " ").slice(0, 80)}`);
      }
      for (const match of source.matchAll(/buttonClass\([^,)]*,\s*"[a-z]+",\s*("[^"]*")/g)) {
        if (SIZING.test(match[1])) hits.push(`${file}: buttonClass ${match[1]}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("small links get a hit area", () => {
    expect(read("components/Footer.tsx")).toMatch(/const link = "[^"]*\bhit\b/);
    expect(read("components/MainnetBanner.tsx")).toMatch(/<a[^>]*className="[^"]*\bhit\b/s);
  });

  it("defines the hit area: 24 px everywhere, 44 px below 768 px", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/\.hit::after\s*\{[^}]*max\(100%, 24px\)/s);
    expect(css).toMatch(/@media \(max-width: 767px\)\s*\{\s*\.hit::after\s*\{[^}]*max\(100%, 44px\)/s);
  });
});

describe("segmented controls", () => {
  it("segmented roles live in Segmented only", () => {
    expect(scanSource([["segmented role", /role="(radiogroup|tablist)"/]], { skip: ["components/ui/Segmented.tsx"] })).toEqual([]);
  });
});
