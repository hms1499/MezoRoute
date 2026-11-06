import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { EASE, MOTION_MS } from "./motion";
import { boxShadow, CONTROL, fontSize, palettes, radius, SPACING_STEPS, TYPE_ROLES } from "./tokens";

// U11 §5.9-5.10: frontend/DESIGN.md is hand-written; this test keeps its YAML front matter equal to the code, so the
// document can never drift from the tokens it describes.

const DOC = readFileSync(join(__dirname, "../../../DESIGN.md"), "utf8");
const FRONT = DOC.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
const doc = parse(FRONT) as Record<string, unknown> & {
  colors: Record<string, Record<string, unknown>>;
  typography: { scale: Record<string, unknown>; roles: Record<string, string>; family: string };
};

describe("DESIGN.md front matter", () => {
  it("has the palettes of both themes", () => {
    expect(doc.colors.light).toEqual(palettes.light);
    expect(doc.colors.dark).toEqual(palettes.dark);
  });

  it("has the type scale, roles, and family", () => {
    expect(doc.typography.scale).toEqual(fontSize);
    expect(doc.typography.roles).toEqual(TYPE_ROLES);
    expect(doc.typography.family).toBe("Geist Mono");
  });

  it("has radius, spacing, controls, icons, elevation, and motion", () => {
    expect(doc.rounded).toEqual(radius);
    expect(doc.spacing).toEqual({ unit: "4px", steps: [...SPACING_STEPS] });
    expect(doc.controls).toEqual(CONTROL);
    expect(doc.icons).toEqual({ ui: [14, 16, 20], token: [16, 20, 24], indicator: 24, logo: { header: 28, footer: 24 } });
    expect(doc.elevation).toEqual(boxShadow);
    expect(doc.motion).toEqual({ ease: { smooth: [...EASE.smooth], swift: [...EASE.swift] }, ms: { fast: MOTION_MS.fast, base: MOTION_MS.base, slow: MOTION_MS.slow } });
  });

  it("has every section", () => {
    for (const heading of ["Overview", "Colors", "Typography", "Layout & Spacing", "Elevation & Depth", "Shapes", "Components", "Motion", "Responsive", "Do's and Don'ts", "Agent Guidelines"]) {
      expect(DOC, heading).toMatch(new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
    }
  });
});
