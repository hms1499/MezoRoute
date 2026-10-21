import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Tests render components with react-dom/server (U10); tsconfig keeps `jsx: preserve` for Next.
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts", "scripts/**/*.test.ts"] },
});
