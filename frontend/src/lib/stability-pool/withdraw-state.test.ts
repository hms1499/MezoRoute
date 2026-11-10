import { describe, expect, it } from "vitest";
import { spWithdrawState } from "./withdraw-state";

// U14 B6: withdraw with nothing deposited is an empty state that leads to a deposit; a gain left after a full
// withdrawal makes Claim the page's primary; any deposit shows the form.
describe("spWithdrawState", () => {
  it.each([
    [0n, 0n, "empty"],
    [0n, 1n, "gain-only"],
    [1n, 0n, "form"],
    [1n, 1n, "form"],
  ] as const)("deposit %s, gain %s → %s", (deposit, gain, state) => {
    expect(spWithdrawState(deposit, gain)).toBe(state);
  });
});
