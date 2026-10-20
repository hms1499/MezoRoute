import { darkTheme, type Theme } from "@rainbow-me/rainbowkit";
import { palettes } from "@/lib/ui/tokens";

const fonts = { body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" };

/**
 * Today's modal in dark mode, unchanged (U9): RainbowKit's own dark colours with the app's accent, radius,
 * and font. Theme options only, no CSS into the library.
 */
export const darkRainbowTheme: Theme = {
  ...darkTheme({ accentColor: palettes.dark.accent, accentColorForeground: palettes.dark.onAccent, borderRadius: "large" }),
  fonts,
};
