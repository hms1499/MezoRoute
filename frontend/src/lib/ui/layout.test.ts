import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// U14 §A: one page width. Every page frames with Column (the shell's content box); flow components render FlowColumn
// (Positions' grid) and wrap their loading, error, and connect states in FlowState, so the card's left edge and
// width never move, between pages or while the data arrive.

function files(dir: string, match: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, match) : match(name) ? [path] : [];
  });
}

const src = join(__dirname, "..", "..");
const app = join(src, "app");

describe("page frames", () => {
  const routes = files(app, (name) => name === "page.tsx").map((file) => {
    const dir = relative(app, file).split(sep).slice(0, -1).join("/");
    return { route: dir === "" ? "/" : `/${dir}/`, source: readFileSync(file, "utf8") };
  });

  it("finds every page", () => {
    expect(routes.length).toBeGreaterThanOrEqual(17);
  });

  it.each(routes.filter((r) => r.route !== "/").map((r) => [r.route, r.source] as const))("%s frames with Column", (_route, source) => {
    expect(source).toContain("<Column");
  });

  it("no source keeps the retired 520 px flow column", () => {
    const offenders = files(src, (name) => /\.tsx?$/.test(name) && !name.endsWith(".test.ts"))
      .filter((file) => /FlowPage|max-w-\[520px\]/.test(readFileSync(file, "utf8")))
      .map((file) => relative(src, file));
    expect(offenders).toEqual([]);
  });
});

// The flow components whose early returns (loading, error, connect, no executor) must keep the card's frame. The Trove
// pages' `Loading` wraps its own LoadError/LoadingCard in FlowState, so the line check covers it.
const FLOW_COMPONENTS = [
  "components/lp/LpRoutePage.tsx",
  "components/lp/LpConfirmPage.tsx",
  "components/stability-pool/SpRoutePage.tsx",
  "components/stability-pool/SpConfirmPage.tsx",
  "components/stability-pool/SpWithdrawPage.tsx",
  "components/positions/ExitPage.tsx",
  "components/trove/TrovePages.tsx",
  "components/receipt/ReceiptPage.tsx",
];

describe("flow states", () => {
  it.each(FLOW_COMPONENTS)("%s frames every early-return state in FlowState", (file) => {
    const lines = readFileSync(join(src, file), "utf8").split("\n");
    const bare = lines.filter((line) => /<(LoadingCard|LoadError|NoExecutorCard)\b/.test(line) && !line.includes("<FlowState>"));
    expect(bare).toEqual([]);
    const gates = lines.filter((line) => line.includes("<RequireWallet") && !/\bflow\b/.test(line));
    expect(gates).toEqual([]);
  });
});
