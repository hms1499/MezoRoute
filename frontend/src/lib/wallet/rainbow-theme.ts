import { cssStringFromTheme, darkTheme, lightTheme, type Theme } from "@rainbow-me/rainbowkit";
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

const light = lightTheme({ accentColor: palettes.light.accent, accentColorForeground: palettes.light.onAccent, borderRadius: "large" });

/** Light mode: RainbowKit's light theme with the modal's surface, text, and borders from the light palette. */
export const lightRainbowTheme: Theme = {
  ...light,
  colors: {
    ...light.colors,
    modalBackground: palettes.light.surface,
    modalText: palettes.light.ink,
    modalTextSecondary: palettes.light.muted,
    modalBorder: palettes.light.line,
  },
  fonts,
};

/**
 * Both themes as one static stylesheet, for `RainbowKitProvider theme={null}`: the modal follows
 * `<html data-theme>` through CSS, so the provider's props never change and the wallet tree never re-renders
 * (a re-render reconnects wagmi and logs Bitcoin wallets out).
 */
export const RAINBOW_THEME_CSS = `[data-rk]{${cssStringFromTheme(lightRainbowTheme)}}html[data-theme="dark"] [data-rk]{${cssStringFromTheme(
  darkRainbowTheme,
  { extends: lightRainbowTheme },
)}}`;
