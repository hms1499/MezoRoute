import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { FLOW_WIDTH, isFlowPath } from "./layout";

// The flow column's width lives in one place, and one rule says which routes are flows: the mainnet banner (AppShell)
// and the route's frame (FlowPage) both follow it, so a flow's left edge never moves (DESIGN.md → FlowColumn).

describe("isFlowPath", () => {
  it.each([
    ["/route/lp/", true],
    ["/route/lp/confirm/", true],
    ["/route/stability-pool", true],
    ["/trove/leverage/confirm/", true],
    ["/tx/", true],
    ["/tx", true],
    ["/positions/lp/exit/", true],
    ["/positions/stability-pool/withdraw/", true],
    ["/", false],
    ["/positions/", false],
    ["/positions", false],
    ["/nope/", false],
    ["/router/", false],
    [null, false],
  ] as const)("%s → %s", (path, flow) => {
    expect(isFlowPath(path)).toBe(flow);
  });

  it("is the 520 px flow width", () => {
    expect(FLOW_WIDTH).toBe("max-w-[520px]");
  });
});

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? pages(path) : name === "page.tsx" ? [path] : [];
  });
}

describe("route frames", () => {
  const app = join(__dirname, "..", "..", "app");
  const routes = pages(app).map((file) => {
    const dir = relative(app, file).split(sep).slice(0, -1).join("/");
    return { route: dir === "" ? "/" : `/${dir}/`, source: readFileSync(file, "utf8") };
  });

  it("finds every page", () => {
    expect(routes.length).toBeGreaterThanOrEqual(17);
  });

  it.each(routes.map((r) => [r.route, r] as const))("%s uses the frame its kind needs", (_route, { route, source }) => {
    // A flow route frames every state it renders (loading, error, connect, the flow) in the flow column; a wide page
    // (Dashboard, Positions) uses Column or its own layout.
    expect(source.includes("<FlowPage"), route).toBe(isFlowPath(route));
  });
});
