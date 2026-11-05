import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blocksProduction, mainnetLegacyExecutors } from "./check-mainnet-pin.mjs";

const source = (mainnetBody: string) => `export const networks = {
  testnet: {
    id: "testnet",
    legacyExecutors: [{ address: "0xB36B", deployBlock: 15_903_010n }],
  },
  mainnet: {
    id: "mainnet",
    ${mainnetBody}
  },
};`;
const unpinned = source("legacyExecutors: [],");
const pinned = source(`legacyExecutors: [{ address: "0x0464", deployBlock: 12_524_142n }],`);

describe("mainnetLegacyExecutors", () => {
  it("reads the mainnet block, not testnet's", () => {
    expect(mainnetLegacyExecutors(unpinned)).toBe("");
    expect(mainnetLegacyExecutors(pinned)).toContain("0x0464");
  });

  it("ignores a commented-out entry", () => {
    expect(mainnetLegacyExecutors(source(`// legacyExecutors: [{ address: "0x0464" }],\n    legacyExecutors: [],`))).toBe("");
  });

  it("fails loudly when it cannot find the mainnet block", () => {
    expect(() => mainnetLegacyExecutors("export const networks = {};")).toThrow(/mainnet block/);
  });

  it("fails loudly when the mainnet block has no legacyExecutors", () => {
    expect(() => mainnetLegacyExecutors(source(`id2: "x",`))).toThrow(/legacyExecutors/);
  });
});

describe("blocksProduction", () => {
  it("blocks only a production build with mainnet unpinned", () => {
    expect(blocksProduction({ VERCEL_ENV: "production" }, unpinned)).toBe(true);
    expect(blocksProduction({ VERCEL_ENV: "production" }, pinned)).toBe(false);
  });

  it("leaves preview and local builds alone", () => {
    expect(blocksProduction({ VERCEL_ENV: "preview" }, unpinned)).toBe(false);
    expect(blocksProduction({}, unpinned)).toBe(false);
  });

  it("does not even read the source outside production, so a config change cannot break a preview", () => {
    expect(blocksProduction({}, "not a config")).toBe(false);
  });

  it("still fails loudly in production when the source cannot be read", () => {
    expect(() => blocksProduction({ VERCEL_ENV: "production" }, "not a config")).toThrow(/mainnet block/);
  });
});

describe("the real networks.ts", () => {
  const real = readFileSync(new URL("../src/lib/config/networks.ts", import.meta.url), "utf8");

  // Task 11 pins mainnet V2, lists V1 under legacyExecutors, and deletes this script with its test.
  it("has mainnet on V1 today, so a production build is blocked", () => {
    expect(mainnetLegacyExecutors(real)).toBe("");
    expect(blocksProduction({ VERCEL_ENV: "production" }, real)).toBe(true);
    expect(blocksProduction({ VERCEL_ENV: "preview" }, real)).toBe(false);
  });
});
