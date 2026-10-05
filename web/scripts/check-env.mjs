// Fails the build when a required public variable is missing. Next inlines NEXT_PUBLIC_* at build
// time, so a missing WalletConnect project id would otherwise only surface in the browser.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_ENV = ["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"];

export function missingEnv(env, names = REQUIRED_ENV) {
  return names.filter((name) => !env[name]?.trim());
}

function main() {
  const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  // @next/env ships with next and loads .env* files the same way `next build` does.
  const { loadEnvConfig } = createRequire(import.meta.url)("@next/env");
  loadEnvConfig(webRoot);
  const missing = missingEnv(process.env);
  if (missing.length > 0) {
    throw new Error(`check-env: missing ${missing.join(", ")} (see web/.env.example; on Vercel, set it in the project env)`);
  }
  console.log("check-env: ok");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
