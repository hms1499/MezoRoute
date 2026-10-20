import { darkTheme } from "@rainbow-me/rainbowkit";
import { describe, expect, it } from "vitest";
import { darkRainbowTheme } from "./rainbow-theme";

describe("RainbowKit themes", () => {
  it("dark theme is today's production theme", () => {
    // Literal hex on purpose: this is what production renders (U9 keeps the dark modal unchanged).
    expect(darkRainbowTheme).toEqual({
      ...darkTheme({ accentColor: "#2DD4BF", accentColorForeground: "#062221", borderRadius: "large" }),
      fonts: { body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" },
    });
  });
});
