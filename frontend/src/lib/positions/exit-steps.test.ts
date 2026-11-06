import { describe, expect, it } from "vitest";
import { exitSteps } from "./exit-steps";

describe("exitSteps", () => {
  it("asks an EOA for an LP permit and a smart account for an exact approval", () => {
    expect(exitSteps("eoa", 0n, 10n, 0n)).toEqual(["permit", "exit"]);
    expect(exitSteps("smart-account", 0n, 10n, 0n)).toEqual(["approve", "exit"]);
    expect(exitSteps("unknown", 9n, 10n, 0n)).toEqual(["approve", "exit"]);
  });

  it("skips the first step when the allowance covers the LP", () => {
    expect(exitSteps("eoa", 10n, 10n, 0n)).toEqual(["exit"]);
    expect(exitSteps("smart-account", 11n, 10n, 0n)).toEqual(["exit"]);
  });

  it("puts the unstake first, so the permit is signed after it confirms", () => {
    expect(exitSteps("eoa", 0n, 50n, 10n)).toEqual(["unstake", "permit", "exit"]);
    expect(exitSteps("smart-account", 0n, 50n, 10n)).toEqual(["unstake", "approve", "exit"]);
    expect(exitSteps("eoa", 50n, 50n, 0n)).toEqual(["exit"]);
    expect(exitSteps("eoa", 50n, 50n, 10n)).toEqual(["unstake", "exit"]);
  });
});
