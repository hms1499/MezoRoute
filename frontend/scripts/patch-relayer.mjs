// Mezo Passport 0.17.2 pulls in @mezo-org/orangekit-smart-account 1.0.0-beta.24, which relays
// Bitcoin-wallet transactions through https://test.mezo.org. That host answers with Cloudflare
// 403 "DNS points to prohibited IP" (checked 3 Oct 2026); the live relayer is
// https://testnet.mezo.org. This script rewrites the URL in the installed package. It runs on
// postinstall and prebuild and fails loudly if the package no longer contains either URL.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DEAD_RELAYER = "https://test.mezo.org/api/v2/relay/";
export const LIVE_RELAYER = "https://testnet.mezo.org/api/v2/relay/";
export const RELAYER_FILES = [
  "dist/src/lib/utils/MezoTransactionSender.js",
  "dist/src/lib/index.js",
];

export function patchRelayerSource(source) {
  if (source.includes(DEAD_RELAYER)) {
    return { status: "patched", source: source.replaceAll(DEAD_RELAYER, LIVE_RELAYER) };
  }
  if (source.includes(LIVE_RELAYER)) return { status: "already-patched", source };
  return { status: "not-found", source };
}

// The package may be hoisted to node_modules/@mezo-org or nested under another @mezo-org package.
function findPackageDirs(root, depth = 0, found = []) {
  const dir = join(root, "node_modules", "@mezo-org", "orangekit-smart-account");
  if (existsSync(join(dir, "package.json"))) found.push(dir);
  const scope = join(root, "node_modules", "@mezo-org");
  if (depth < 3 && existsSync(scope)) {
    for (const entry of readdirSync(scope)) findPackageDirs(join(scope, entry), depth + 1, found);
  }
  return found;
}

function main() {
  const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const dirs = findPackageDirs(webRoot);
  if (dirs.length === 0) throw new Error("patch-relayer: @mezo-org/orangekit-smart-account is not installed");
  for (const dir of dirs) {
    for (const file of RELAYER_FILES) {
      const path = join(dir, file);
      const { status, source } = patchRelayerSource(readFileSync(path, "utf8"));
      if (status === "not-found") {
        throw new Error(`patch-relayer: no relayer URL in ${path}; the package changed, re-check the endpoint`);
      }
      if (status === "patched") writeFileSync(path, source);
      console.log(`patch-relayer: ${status} ${path}`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
