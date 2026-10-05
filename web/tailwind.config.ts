import type { Config } from "tailwindcss";

// "Calm teal" (F1 design): light canvas, one accent, amber reserved for warnings.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F6F8F7",
        ink: "#1F2A2E",
        muted: "#4B5B5F",
        line: "#E4ECEA",
        accent: { DEFAULT: "#0F766E", soft: "#ECF5F3" },
        warning: { bg: "#FEF3C7", ink: "#92400E" },
        danger: { DEFAULT: "#B42318", soft: "#FEECEB" },
      },
      boxShadow: { card: "0 1px 3px rgba(15, 40, 40, 0.06)" },
    },
  },
  plugins: [],
};

export default config;
