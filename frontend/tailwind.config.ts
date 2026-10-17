import type { Config } from "tailwindcss";
import { colors, fontSize } from "./src/lib/ui/tokens";

// One dark palette (U3): teal for actions and the LP route, lavender for the Stability Pool, orange only for BTC exposure.
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
        "night-glow": `radial-gradient(1100px 520px at 25% -5%, ${colors.night.glow} 0%, ${colors.night.bg} 62%)`,
      },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } },
        "toast-in": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        shimmer: "shimmer 1.6s linear infinite",
        "toast-in": "toast-in 200ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
