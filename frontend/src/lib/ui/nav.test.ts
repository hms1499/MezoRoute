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
  it("hides Proof and Trove below 1024 px (U20) and the other links below 640 px when they are not the one mobile link", async () => {
    const { navHideClass } = await import("./nav");
    // U20 QA: with Trove a fourth link, the connected header ran 102 px past the page at 768 px; Proof waits for 1024.
    expect(navHideClass("/proof/", "/")).toBe("max-lg:hidden");
    expect(navHideClass("/proof/", "/proof/")).toBe("max-lg:hidden");
    expect(navHideClass("/", "/")).toBe("max-sm:hidden");
    expect(navHideClass("/positions/", "/")).toBeNull();
    expect(navHideClass("/", "/proof/")).toBeNull();
  });
});

describe("the Trove tab (U20)", () => {
  it("shows Dashboard on /trove/ only, and never Trove itself below 640 px", async () => {
    const { navHideClass } = await import("./nav");
    expect(onMobile("/trove/", "/")).toBe(false);
    expect(onMobile("/trove/", "/trove/")).toBe(false);
    expect(onMobile("/", "/trove/")).toBe(true);
    expect(onMobile("/positions/", "/trove/")).toBe(false);
    expect(onMobile("/positions/", "/trove/unwind/")).toBe(true); // flow pages unchanged
    // U20 QA: at 768 px a connected header with Dashboard, Positions and Trove still ran 24 px past the page.
    expect(navHideClass("/trove/", "/")).toBe("max-lg:hidden");
    expect(navHideClass("/trove/", "/trove/")).toBe("max-lg:hidden");
    expect(navHideClass("/", "/trove/")).toBeNull();
  });
});
