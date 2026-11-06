import { describe, expect, it } from "vitest";
import { lineOffences, scanSource, type GuardRule } from "./source-scan";
import { SPACING_STEPS } from "./tokens";

// U11 §5.3: spacing moves in 4 px steps. Padding, margin, gap, and space-* take only SPACING_STEPS (0.5 = 2 px is
// the one half step, for hairline offsets and a segmented track's inner padding); no arbitrary values. Positioning
// offsets (top/left/inset) follow an element's geometry, not the rhythm, and Tailwind's spacing theme stays whole so
// sizing classes (h-7, h-9, h-11, w-3.5) keep working.

const PROPERTY = "(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|scroll-m|scroll-mx|scroll-my|scroll-mt|scroll-mb|scroll-p|scroll-pt|scroll-pb)";
const ALLOWED = new Set(SPACING_STEPS.map(String));

function offStep(line: string): boolean {
  for (const match of line.matchAll(new RegExp(`(?<![\\w-])-?${PROPERTY}-([0-9.]+|\\[[^\\]]*\\]|px)(?![\\w.-])`, "g"))) {
    const value = match[1];
    if (value === "px") continue;
    if (value.startsWith("[") || !ALLOWED.has(value)) return true;
  }
  return false;
}

const RULES: GuardRule[] = [["spacing", offStep]];
const offences = (line: string) => lineOffences(RULES, line, false);

describe("spacing steps", () => {
  it("is the spec's list", () => {
    expect(SPACING_STEPS).toEqual([0, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]);
  });

  it("catches half steps and arbitrary spacing", () => {
    for (const line of ["px-3.5", "gap-1.5", "py-2.5", "mt-[3px]", "gap-[3px]", "space-y-[10px]", "mt-7", "sm:py-14", "max-sm:px-2.5", "-mt-1.5"]) {
      expect(offences(line), line).toEqual(["spacing"]);
    }
  });

  it("lets the steps, sizing, and positioning through", () => {
    for (const line of ["p-5 gap-3 px-0.5 -mt-1 space-y-6 py-px", "h-[2px] w-[120px] h-9 min-h-11 w-3.5", "top-9 left-0.5 -top-[5px] inset-x-0", "sm:px-10 md:gap-12"]) {
      expect(offences(line), line).toEqual([]);
    }
  });

  it("finds no off-step spacing", () => {
    expect(scanSource(RULES)).toEqual([]);
  });
});
