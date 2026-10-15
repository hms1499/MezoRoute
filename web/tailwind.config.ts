import type { Config } from "tailwindcss";
import { colors } from "./src/lib/ui/tokens";

// "Calm teal" (F1, refined in U1): light canvas, one accent, amber for warnings, orange only to mark BTC exposure.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors,
      fontFamily: { sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"] },
      boxShadow: {
        card: "0 1px 3px rgba(15, 40, 40, 0.06)",
        raised: "0 8px 24px rgba(15, 40, 40, 0.10)",
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
