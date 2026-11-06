import { describe, expect, it } from "vitest";
import { enterStepDetail, entrySteps } from "./steps";

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

describe("entrySteps in borrow mode", () => {
  it("signs a permit and the borrow authorisation, then sends", () => {
    expect(entrySteps("eoa", 0n, 5n, "borrow")).toEqual(["permit", "borrow", "enter"]);
  });

  it("skips the permit when the allowance covers the amount", () => {
    expect(entrySteps("eoa", 5n, 5n, "borrow")).toEqual(["borrow", "enter"]);
  });
});

describe("enterStepDetail", () => {
  it("names the stake only when the entry really stakes, for MUSD and BTC alike", () => {
    expect(enterStepDetail({ mode: "deposit", stake: false })).toBe("One transaction: fee, swap, and add liquidity. Leftovers return to you.");
    expect(enterStepDetail({ mode: "deposit", stake: true })).toBe("One transaction: fee, swap, add liquidity, and stake. Leftovers return to you.");
  });

  it("names the borrow in Borrow & Deploy, which happens inside the same transaction", () => {
    expect(enterStepDetail({ mode: "borrow", stake: false })).toBe("One transaction: borrow, fee, swap, and add liquidity. Leftovers return to you.");
    expect(enterStepDetail({ mode: "borrow", stake: true })).toBe("One transaction: borrow, fee, swap, add liquidity, and stake. Leftovers return to you.");
  });
});
