import { describe, expect, it } from "vitest";
import { mix } from "./contrast";
import { colors, palettes, TEXT_PAIRS, themeVariables } from "./tokens";

const triplet = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(" ");

describe("palettes", () => {
  it("light and dark palettes have the same keys", () => {
    expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
  });

  it("dark palette is today's production palette", () => {
    expect(palettes.dark).toMatchObject({
      canvas: "#0A1416",
      surface: "#162022",
      well: "#0F1A1C",
      ink: "#E8F1EF",
      muted: "#9FB3AF",
      line: "#222B2D",
      accent: "#2DD4BF",
      onAccent: "#062221",
      sp: "#A5B4FC",
      btc: "#FB923C",
      danger: "#F87171",
      warning: "#FCD34D",
      glow: "#123B3A",
    });
  });

  it("light palette is the spec's table", () => {
    expect(palettes.light).toMatchObject({
      canvas: "#EEF4F2",
      surface: "#FFFFFF",
      well: "#F3F7F6",
      ink: "#0B2523",
      muted: "#3F5551",
      line: "#D5E1DE",
      accent: "#0F766E",
      onAccent: "#FFFFFF",
      sp: "#4338CA",
      btc: "#B03A0B",
      danger: "#B91C1C",
      warning: "#92400E",
      glow: "#D3EBE5",
    });
  });
});

describe("themeVariables", () => {
  it("writes light on :root and dark under data-theme", () => {
    const vars = themeVariables();
    const light = vars[":root"];
    const dark = vars[':root[data-theme="dark"]'];
    expect(light["--color-accent"]).toBe("15 118 110");
    expect(dark["--color-accent"]).toBe("45 212 191");
    expect(dark["--color-accent-soft"]).toBe(triplet(mix("#2DD4BF", "#162022", 0.12)));
    expect(light["--color-accent-soft"]).toBe(triplet(mix("#0F766E", "#FFFFFF", 0.12)));
    expect(light["color-scheme"]).toBe("light");
    expect(dark["color-scheme"]).toBe("dark");
  });

  it("writes the same variable names for both themes", () => {
    const vars = themeVariables();
    expect(Object.keys(vars[":root"]).sort()).toEqual(Object.keys(vars[':root[data-theme="dark"]']).sort());
  });
});

describe("Tailwind colours", () => {
  it("are variable references", () => {
    expect(colors.accent.DEFAULT).toBe("rgb(var(--color-accent) / <alpha-value>)");
    expect(colors.warning.bg).toBe("rgb(var(--color-warning-bg) / <alpha-value>)");
    expect(colors.night.lp).toBe(colors.accent.DEFAULT);
  });
});

describe("TEXT_PAIRS", () => {
  it("covers both palettes", () => {
    const light = TEXT_PAIRS.filter(([name]) => name.startsWith("light: "));
    const dark = TEXT_PAIRS.filter(([name]) => name.startsWith("dark: "));
    expect(light.length).toBeGreaterThan(0);
    expect(light.length).toBe(dark.length);
    expect(light.length + dark.length).toBe(TEXT_PAIRS.length);
  });
});
