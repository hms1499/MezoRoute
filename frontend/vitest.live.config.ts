import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Live checks against a real chain (spec F8): never part of `npm test`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["scripts/live/**/*.live.ts"], testTimeout: 600_000 },
});
