import { describe, expect, it } from "vitest";
import { amountFieldError } from "./amount";
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
  it("removes commas only from well-formed thousands grouping", () => {
    expect(stripGrouping("1,000")).toBe("1000");
    expect(stripGrouping("1,000.5")).toBe("1000.5");
    expect(stripGrouping("12,345,678.9")).toBe("12345678.9");
    expect(stripGrouping("1,000.")).toBe("1000.");
    expect(stripGrouping("1000")).toBe("1000");
  });

  it("never turns a decimal comma into a bigger amount", () => {
    for (const text of ["0,5", "1,5", "1000,5", "1,00", "1,0000", "a,b", ",5"]) expect(stripGrouping(text)).toBe(text);
  });

  it("leaves a decimal comma as a field error, not a parsed amount", () => {
    expect(amountFieldError(stripGrouping("0,5"), "musd")).not.toBeNull();
    expect(amountFieldError(stripGrouping("0,01"), "btc")).not.toBeNull();
  });
});
