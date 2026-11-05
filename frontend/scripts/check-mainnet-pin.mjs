// Merge gate for G1: the frontend's ABI is V2 but mainnet still runs V1, and a push to main deploys production.
// Fails a production build until Task 11 deploys V2 on mainnet and lists V1 under `legacyExecutors`. Task 11 removes this.
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** What sits between the brackets of mainnet's `legacyExecutors`, trimmed. Throws if the source has changed shape. */
export function mainnetLegacyExecutors(source) {
  const code = source.replace(/^\s*\/\/.*$/gm, "");
  const start = code.search(/^\s*mainnet:\s*\{/m);
  if (start === -1) throw new Error("check-mainnet-pin: mainnet block not found in networks.ts");
  const match = code.slice(start).match(/legacyExecutors:\s*\[([^\]]*)\]/);
  if (!match) throw new Error("check-mainnet-pin: legacyExecutors not found in the mainnet block of networks.ts");
  return match[1].trim();
}

export function blocksProduction(env, source) {
  return env.VERCEL_ENV === "production" && mainnetLegacyExecutors(source) === "";
}

function main() {
  const file = join(dirname(fileURLToPath(import.meta.url)), "../src/lib/config/networks.ts");
  if (blocksProduction(process.env, readFileSync(file, "utf8"))) {
    throw new Error("check-mainnet-pin: mainnet is not pinned to V2 (legacyExecutors is empty), so this branch must not reach production. See G1 Task 11.");
  }
  console.log("check-mainnet-pin: ok");
}

// Real paths on both sides: argv keeps a symlink that import.meta.url resolves, and a gate that silently skips is no gate.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
