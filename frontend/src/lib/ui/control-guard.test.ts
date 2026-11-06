import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTROL } from "./tokens";
import { scanSource, sourceFiles } from "./source-scan";

// U11 §5.4: three control heights, and every target at least 24 px (44 px below 768 px) through `.hit`.

const SRC = join(__dirname, "../..");
const read = (file: string) => readFileSync(join(SRC, file), "utf8");

/** Buttons whose size a caller overrides from outside; the header's account button until Task 6 reworks the header. */
const OUTSIDE_SIZING_EXCEPTIONS = new Set(["components/Header.tsx"]);
const SIZING = /(?<![\w-])(?:[\w-]+:)?(?:min-h-|h-\d|px-|py-|p-\d|pl-|pr-|text-(?:xs|sm|base)\b)/;

describe("control sizes", () => {
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
      for (const match of source.matchAll(/<(?:Button|ButtonLink)\b[^>]*?className=("[^"]*"|\{[^}]*\})/gs)) {
        if (SIZING.test(match[1])) hits.push(`${file}: ${match[1].replace(/\s+/g, " ").slice(0, 80)}`);
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
    // NetworkSwitch.tsx until Task 6 replaces it with the network menu.
    expect(scanSource([["segmented role", /role="(radiogroup|tablist)"/]], { skip: ["components/ui/Segmented.tsx", "components/NetworkSwitch.tsx"] })).toEqual([]);
  });
});
