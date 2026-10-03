import { describe, expect, it } from "vitest";
import { parseMusdAmount } from "./amount";

describe("parseMusdAmount", () => {
  it.each([
    ["1.5", 1_500000000000000000n],
    [" 20 ", 20_000000000000000000n],
    [".5", 500000000000000000n],
    ["1.", 1_000000000000000000n],
    ["0.000000000000000001", 1n],
    ["1000000", 1_000_000_000000000000000000n],
  ])("parses %j", (input, expected) => {
    expect(parseMusdAmount(input)).toBe(expected);
  });

  it.each(["", ".", "0", "0.000", "abc", "-1", "1e3", "1,5", "1.1234567890123456789"])("rejects %j", (input) => {
    expect(parseMusdAmount(input)).toBeNull();
  });
});
