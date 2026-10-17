import { describe, expect, it } from "vitest";
import { exitSteps } from "./exit-steps";

describe("exitSteps", () => {
  it("asks an EOA for an LP permit and a smart account for an exact approval", () => {
    expect(exitSteps("eoa", 0n, 10n)).toEqual(["permit", "exit"]);
    expect(exitSteps("smart-account", 0n, 10n)).toEqual(["approve", "exit"]);
    expect(exitSteps("unknown", 9n, 10n)).toEqual(["approve", "exit"]);
  });

  it("skips the first step when the allowance covers the LP", () => {
    expect(exitSteps("eoa", 10n, 10n)).toEqual(["exit"]);
    expect(exitSteps("smart-account", 11n, 10n)).toEqual(["exit"]);
  });
});
