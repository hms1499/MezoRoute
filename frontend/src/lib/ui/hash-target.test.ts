import { describe, expect, it } from "vitest";
import { isHashTarget } from "./hash-target";

// U12: only the disclosure's own hash opens it.

describe("isHashTarget", () => {
  it("matches the element's own hash", () => {
    expect(isHashTarget("#details", "details")).toBe(true);
  });

  it("ignores a longer or different hash", () => {
    expect(isHashTarget("#details-2", "details")).toBe(false);
    expect(isHashTarget("#other", "details")).toBe(false);
  });

  it("ignores an empty hash", () => {
    expect(isHashTarget("", "details")).toBe(false);
  });

  it("decodes the hash the browser wrote", () => {
    expect(isHashTarget("#det%61ils", "details")).toBe(true);
  });
});
