import { describe, expect, it } from "vitest";
import { isCurrentPath, onMobile } from "./nav";

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

describe("onMobile", () => {
  it("shows the other main page below 640 px: Positions everywhere, Dashboard on Positions and its flows (U8)", () => {
    expect(onMobile("/positions/", "/")).toBe(true);
    expect(onMobile("/positions/", "/route/lp/")).toBe(true);
    expect(onMobile("/positions/", "/positions/")).toBe(false);
    expect(onMobile("/", "/positions/")).toBe(true);
    expect(onMobile("/", "/positions/lp/exit/")).toBe(true);
    expect(onMobile("/", "/")).toBe(false);
    expect(onMobile("/", null)).toBe(false);
  });
});
