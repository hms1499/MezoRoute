// Next caches compiled node_modules by package version, so a stale cache could ship OrangeKit
// without the relayer patch. After `next build`, check the exported chunks themselves.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEAD_RELAYER, LIVE_RELAYER } from "./patch-relayer.mjs";

export function checkBundle(sources) {
  let live = false;
  for (const source of sources) {
    if (source.includes(DEAD_RELAYER)) return { ok: false, reason: `a chunk still contains ${DEAD_RELAYER}` };
    if (source.includes(LIVE_RELAYER)) live = true;
  }
  return live ? { ok: true } : { ok: false, reason: `no chunk contains ${LIVE_RELAYER}` };
}

function main() {
  const staticDir = join(dirname(fileURLToPath(import.meta.url)), "..", "out", "_next", "static");
  if (!existsSync(staticDir)) throw new Error(`check-relayer-bundle: ${staticDir} is missing; run next build first`);
  const files = readdirSync(staticDir, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith(".js"))
    .map((file) => join(staticDir, file));
  const result = checkBundle(files.map((file) => readFileSync(file, "utf8")));
  if (!result.ok) throw new Error(`check-relayer-bundle: ${result.reason}`);
  console.log(`check-relayer-bundle: ok (${files.length} chunks)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
