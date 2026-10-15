import { describe, expect, it } from "vitest";
import { isCurrentPath } from "./nav";

describe("isCurrentPath", () => {
  it("matches the dashboard only on the root", () => {
    expect(isCurrentPath("/", "/")).toBe(true);
    expect(isCurrentPath("/positions/", "/")).toBe(false);
  });

  it("matches a section and the pages under it, with or without the trailing slash", () => {
    expect(isCurrentPath("/positions/", "/positions/")).toBe(true);
    expect(isCurrentPath("/positions", "/positions/")).toBe(true);
    expect(isCurrentPath("/positions/lp/exit/", "/positions/")).toBe(true);
  });

  it("does not match other sections or a missing path", () => {
    expect(isCurrentPath("/route/lp/", "/positions/")).toBe(false);
    expect(isCurrentPath("/positionsx/", "/positions/")).toBe(false);
    expect(isCurrentPath(null, "/")).toBe(false);
  });
});
