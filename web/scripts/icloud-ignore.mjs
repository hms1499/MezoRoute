// The repo sits in an iCloud-synced Desktop. Marking .next/ with this xattr makes iCloud (macOS
// File Provider) skip it; next build empties .next/ but keeps the directory, so the mark survives.
// out/ is left alone: next build deletes and recreates it, which drops the mark, and iCloud then
// sees a new "out" beside the one it recorded and renames ours to "out 2".
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ICLOUD_IGNORE_ATTR = "com.apple.fileprovider.ignore#P";
const IGNORED_DIRS = [".next"];

export function ignoreCommands(platform, webRoot) {
  if (platform !== "darwin") return [];
  return IGNORED_DIRS.map((dir) => ["xattr", ["-w", ICLOUD_IGNORE_ATTR, "1", join(webRoot, dir)]]);
}

function main() {
  const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const commands = ignoreCommands(process.platform, webRoot);
  for (const [command, args] of commands) {
    mkdirSync(args[args.length - 1], { recursive: true });
    execFileSync(command, args);
  }
  console.log(`icloud-ignore: ${commands.length === 0 ? "skipped (not macOS)" : `marked ${IGNORED_DIRS.join(", ")}`}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
