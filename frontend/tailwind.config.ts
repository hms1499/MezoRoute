import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { MOTION_ANIMATIONS, MOTION_KEYFRAMES, MOTION_MS, motionVariables } from "./src/lib/ui/motion";
import { colors, fontSize, themeVariables } from "./src/lib/ui/tokens";

// Two palettes (U9), U3 roles: teal for actions and the LP route, lavender for the Stability Pool, orange only for
// BTC exposure. Colours are CSS variables that the plugin below writes from tokens.ts: light on :root, dark under
// <html data-theme="dark">.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // U6: replaces Tailwind's sizes, so an off-scale class such as `text-lg` does not exist (typography.test.ts names it).
    fontSize,
    extend: {
      colors,
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backgroundImage: {
        "night-glow": "radial-gradient(1100px 520px at 25% -5%, rgb(var(--color-glow)) 0%, rgb(var(--color-canvas)) 62%)",
      },
      // U10: one curve and three durations (motion.ts); a bare `transition-colors` is already on-token.
      transitionTimingFunction: { DEFAULT: "var(--ease-smooth)", smooth: "var(--ease-smooth)", swift: "var(--ease-swift)" },
      transitionDuration: {
        DEFAULT: "var(--motion-fast)",
        fast: "var(--motion-fast)",
        base: "var(--motion-base)",
        slow: "var(--motion-slow)",
        tick: `${MOTION_MS.tick}ms`,
      },
      keyframes: MOTION_KEYFRAMES,
      animation: MOTION_ANIMATIONS,
    },
  },
  plugins: [plugin(({ addBase }) => addBase({ ...themeVariables(), ":root": { ...themeVariables()[":root"], ...motionVariables() } }))],
};

export default config;
