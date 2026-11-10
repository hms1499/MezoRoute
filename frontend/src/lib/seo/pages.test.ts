import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGES, pageMetadata } from "./pages";

// U14 B5: every route has its own title (static metadata from a segment layout: every page.tsx is a client module and
// share crawlers do not run JavaScript); the root template adds " | MezoRoute".

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? pages(path) : name === "page.tsx" ? [path] : [];
  });
}

const app = join(__dirname, "..", "..", "app");
const routes = pages(app)
  .map((file) => relative(app, file).split(sep).slice(0, -1))
  .filter((parts) => parts.length > 0)
  .map((parts) => ({ route: `/${parts.join("/")}/`, dir: join(app, ...parts) }));

describe("page metadata", () => {
  it.each(routes.map((r) => [r.route, r.dir] as const))("%s has a layout that names its own route", (route, dir) => {
    expect(PAGES).toHaveProperty([route]);
    expect(readFileSync(join(dir, "layout.tsx"), "utf8")).toContain(`pageMetadata("${route}")`);
  });

  it("covers exactly the app's routes", () => {
    expect(Object.keys(PAGES).sort()).toEqual(routes.map((r) => r.route).sort());
  });

  it("gives every route a different title, without the brand (the template adds it)", () => {
    const titles = Object.values(PAGES).map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const title of titles) expect(title).not.toContain("MezoRoute");
  });

  it("keeps confirm, exit, withdraw, and receipt pages out of search results (their URLs carry an amount or a hash)", () => {
    for (const [route, page] of Object.entries(PAGES)) {
      expect(page.noindex === true, route).toBe(route.includes("confirm") || route === "/tx/" || route.endsWith("/exit/") || route.endsWith("/withdraw/"));
    }
  });

  it("fills the share card from the same title and description", () => {
    const meta = pageMetadata("/route/lp/");
    expect(meta.title).toBe("Add liquidity");
    expect(meta.openGraph).toMatchObject({ title: "Add liquidity", description: PAGES["/route/lp/"].description });
    expect(pageMetadata("/route/lp/confirm/").robots).toEqual({ index: false });
  });
});
