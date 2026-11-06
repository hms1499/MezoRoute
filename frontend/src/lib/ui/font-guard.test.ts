import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../../tailwind.config";
import { scanSource } from "./source-scan";

// U11 §5.1: one font, Geist Mono, self-hosted (Next 14.2.35's next/font/google has no Geist Mono) with its OFL licence.

const SRC = join(__dirname, "../..");

describe("one font", () => {
  it("loads only Geist Mono", () => {
    const layout = readFileSync(join(SRC, "app/layout.tsx"), "utf8");
    expect(layout).toContain('from "next/font/local"');
    expect(layout).toContain("GeistMono");
    expect(scanSource([["other font", /\b(Inter|JetBrains_Mono)\b/]])).toEqual([]);
  });

  it("has one family for sans and mono", () => {
    const family = config.theme?.extend?.fontFamily as Record<string, string[]>;
    expect(family.sans[0]).toBe("var(--font-geist-mono)");
    expect(family.sans).toEqual(family.mono);
  });

  it("ships the font with its licence", () => {
    expect(existsSync(join(SRC, "fonts/GeistMono-Variable.woff2"))).toBe(true);
    expect(readFileSync(join(SRC, "fonts/OFL.txt"), "utf8")).toContain("SIL Open Font License");
  });
});
