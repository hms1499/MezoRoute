// U14 B5: titles come from static segment metadata. After `next build`, check the exported HTML itself, so a layout
// that stops exporting metadata (or a page that turns client-only) fails the build instead of shipping one title.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function checkMetadata({ lp, confirm, notFound }) {
  if (!lp.includes("<title>Add liquidity | MezoRoute</title>")) return { ok: false, reason: "route/lp has no page title" };
  if (!lp.includes("og:image")) return { ok: false, reason: "route/lp has no og:image" };
  if (!confirm.includes("<title>Review your deposit | MezoRoute</title>")) return { ok: false, reason: "route/lp/confirm has no page title" };
  if (!confirm.includes("noindex")) return { ok: false, reason: "route/lp/confirm is not noindex" };
  if (!notFound.includes("Page not found | MezoRoute")) return { ok: false, reason: "404.html has no MezoRoute title" };
  return { ok: true };
}

function main() {
  const out = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
  const read = (path) => {
    const file = join(out, path);
    if (!existsSync(file)) throw new Error(`check-metadata: ${file} is missing; run next build first`);
    return readFileSync(file, "utf8");
  };
  const result = checkMetadata({
    lp: read("route/lp/index.html"),
    confirm: read("route/lp/confirm/index.html"),
    notFound: read("404.html"),
  });
  if (!result.ok) throw new Error(`check-metadata: ${result.reason}`);
  console.log("check-metadata: ok");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
