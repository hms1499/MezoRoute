import { darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { describe, expect, it } from "vitest";
import { palettes } from "@/lib/ui/tokens";
import { darkRainbowTheme, lightRainbowTheme, RAINBOW_THEME_CSS } from "./rainbow-theme";

describe("RainbowKit themes", () => {
  it("dark theme is today's production theme", () => {
    // Literal hex on purpose: this is what production renders (U9 keeps the dark modal unchanged).
    expect(darkRainbowTheme).toEqual({
      ...darkTheme({ accentColor: "#2DD4BF", accentColorForeground: "#062221", borderRadius: "large" }),
      fonts: { body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" },
    });
  });

  it("light theme uses the light palette", () => {
    const { colors } = lightRainbowTheme;
    expect(colors.accentColor).toBe(palettes.light.accent);
    expect(colors.accentColorForeground).toBe(palettes.light.onAccent);
    expect(colors.modalBackground).toBe(palettes.light.surface);
    expect(colors.modalText).toBe(palettes.light.ink);
    expect(colors.modalTextSecondary).toBe(palettes.light.muted);
    expect(colors.modalBorder).toBe(palettes.light.line);
    expect(lightRainbowTheme.radii).toEqual(lightTheme({ borderRadius: "large" }).radii);
    // RainbowKit's dialog shadow stays, as in dark: the no-shadow rule is for the app's panels.
    expect(lightRainbowTheme.shadows).toEqual(lightTheme().shadows);
    expect(lightRainbowTheme.fonts).toEqual(darkRainbowTheme.fonts);
  });

  it("stylesheet puts light on [data-rk] and scopes dark under data-theme", () => {
    expect(RAINBOW_THEME_CSS.startsWith("[data-rk]{")).toBe(true);
    expect(RAINBOW_THEME_CSS).toContain('html[data-theme="dark"] [data-rk]{');
    expect(RAINBOW_THEME_CSS).toContain(`--rk-colors-modalBackground:${palettes.light.surface}`);
    expect(RAINBOW_THEME_CSS).toContain("--rk-colors-modalBackground:#1A1B1F");
  });
});
