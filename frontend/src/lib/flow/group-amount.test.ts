import { describe, expect, it } from "vitest";
import { groupAmount, stripGrouping } from "./group-amount";

describe("groupAmount", () => {
  it("groups the integer part of a well-formed amount", () => {
    expect(groupAmount("1000")).toBe("1,000");
    expect(groupAmount("12345.67")).toBe("12,345.67");
    expect(groupAmount("1000.")).toBe("1,000.");
    expect(groupAmount("1234567")).toBe("1,234,567");
  });

  it("leaves short, empty, and malformed text exactly as typed", () => {
    for (const text of [".5", "999", "", "1.2.3", "abc", ".", "1,000"]) expect(groupAmount(text)).toBe(text);
  });
});

describe("stripGrouping", () => {
  it("removes commas only", () => {
    expect(stripGrouping("1,000.5")).toBe("1000.5");
    expect(stripGrouping("1000")).toBe("1000");
    expect(stripGrouping("a,b")).toBe("ab");
  });
});
