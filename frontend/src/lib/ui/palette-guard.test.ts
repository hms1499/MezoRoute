import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every colour must come from tokens.ts, which contrast.test.ts checks; Tailwind's default palette
// bypasses that check (the U3 review found teal-300 actions on the light toast at 1.29:1).
const DEFAULT_PALETTE =
  /\b(?:text|bg|border|ring|fill|stroke|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

describe("palette guard", () => {
  it("uses only design-token colours in components", () => {
    const root = join(__dirname, "..", "..");
    const hits = [...files(join(root, "components")), ...files(join(root, "app"))].flatMap((path) =>
      [...readFileSync(path, "utf8").matchAll(DEFAULT_PALETTE)].map((m) => `${path.slice(root.length + 1)}: ${m[0]}`),
    );
    expect(hits).toEqual([]);
  });
});
