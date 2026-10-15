import { describe, expect, it } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("joins the truthy parts with one space", () => {
    expect(cx("a", false, "b", null, undefined, "", "c")).toBe("a b c");
  });

  it("returns an empty string when nothing is set", () => {
    expect(cx(false, null, undefined)).toBe("");
  });
});
