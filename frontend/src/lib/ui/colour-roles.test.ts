import { describe, expect, it } from "vitest";
import { palettes, TEXT_PAIRS } from "./tokens";
import { signedTone } from "./signed";

// U11 §5.5: positive and negative for signed financial figures only; both reach AA on every surface, and positive
// stays visibly apart from the teal accent so a gain never reads as an action.

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const distance = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

describe("colour roles", () => {
  it("checks positive and negative on every surface in both themes", () => {
    const names = TEXT_PAIRS.map(([name]) => name);
    for (const theme of ["light", "dark"]) for (const role of ["positive", "negative"]) for (const surface of ["canvas", "surface", "well"]) {
      expect(names).toContain(`${theme}: ${role} on ${surface}`);
    }
  });

  it("keeps positive apart from the accent", () => {
    for (const theme of ["light", "dark"] as const) expect(distance(palettes[theme].positive, palettes[theme].accent)).toBeGreaterThanOrEqual(40);
  });

  it("gives negative danger's hue", () => {
    for (const theme of ["light", "dark"] as const) expect(palettes[theme].negative).toBe(palettes[theme].danger);
  });
});

describe("signedTone", () => {
  it("colours a gain, a loss, and nothing for zero", () => {
    expect(signedTone(1n)).toBe("positive");
    expect(signedTone(-1n)).toBe("negative");
    expect(signedTone(0n)).toBeNull();
  });
});
