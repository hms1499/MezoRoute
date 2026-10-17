import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEAD_RELAYER, LIVE_RELAYER, RELAYER_FILES } from "./patch-relayer.mjs";

const require = createRequire(import.meta.url);
const packageDir = dirname(require.resolve("@mezo-org/orangekit-smart-account/package.json"));

describe("installed OrangeKit smart-account package", () => {
  it.each(RELAYER_FILES)("%s relays through testnet.mezo.org", (file) => {
    const source = readFileSync(join(packageDir, file), "utf8");
    expect(source).toContain(LIVE_RELAYER);
    expect(source).not.toContain(DEAD_RELAYER);
  });
});
