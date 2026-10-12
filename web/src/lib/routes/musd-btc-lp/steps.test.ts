import { describe, expect, it } from "vitest";
import { entrySteps } from "./steps";

describe("entrySteps", () => {
  it("plans a permit for an EOA", () => {
    expect(entrySteps("eoa", 0n, 5n)).toEqual(["permit", "enter"]);
  });

  it("plans an exact approval for a smart account", () => {
    expect(entrySteps("smart-account", 4n, 5n)).toEqual(["approve", "enter"]);
  });

  it("plans an approval for an unknown wallet kind", () => {
    expect(entrySteps("unknown", 0n, 5n)).toEqual(["approve", "enter"]);
  });

  it("skips authorisation when the allowance covers the amount", () => {
    expect(entrySteps("eoa", 5n, 5n)).toEqual(["enter"]);
    expect(entrySteps("smart-account", 6n, 5n)).toEqual(["enter"]);
  });
});
