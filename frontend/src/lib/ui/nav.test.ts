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

describe("onMobile with Proof (U19)", () => {
  it("shows Dashboard on Proof, and never Proof itself below 640 px", () => {
    expect(onMobile("/", "/proof/")).toBe(true);
    expect(onMobile("/positions/", "/proof/")).toBe(false);
    expect(onMobile("/proof/", "/")).toBe(false);
    expect(onMobile("/proof/", "/proof/")).toBe(false);
    expect(onMobile("/positions/", "/")).toBe(true);
  });
});

describe("navHideClass (U19 review: the header at 640–686 px)", () => {
  it("hides Proof below 768 px and the other links below 640 px when they are not the one mobile link", async () => {
    const { navHideClass } = await import("./nav");
    expect(navHideClass("/proof/", "/")).toBe("max-md:hidden");
    expect(navHideClass("/proof/", "/proof/")).toBe("max-md:hidden");
    expect(navHideClass("/", "/")).toBe("max-sm:hidden");
    expect(navHideClass("/positions/", "/")).toBeNull();
    expect(navHideClass("/", "/proof/")).toBeNull();
  });
});
