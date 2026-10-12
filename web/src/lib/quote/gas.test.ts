import { describe, expect, it } from "vitest";
import { BORROW_ENTER_GAS, BORROW_ENTER_NO_HINTS_GAS, borrowEnterGas, gasLimit } from "./gas";

describe("gasLimit", () => {
  it("never goes below the measured budget, so a broken RPC estimate cannot send an out-of-gas transaction", () => {
    // A Mezo testnet RPC backend answered eth_estimateGas with the bare intrinsic gas (21,064 for
    // claimFees, 24,408 for enter) on 12 Oct 2026.
    expect(gasLimit(495_000n, 24_408n)).toBe(495_000n);
    expect(gasLimit(495_000n, undefined)).toBe(495_000n);
  });

  it("takes the estimate plus 20% when the call needs more than the budget", () => {
    expect(gasLimit(495_000n, 1_000_000n)).toBe(1_200_000n);
  });
});

describe("borrowEnterGas", () => {
  it("budgets for the SortedTroves walk when no hints were found", () => {
    expect(borrowEnterGas(true)).toBe(BORROW_ENTER_GAS);
    expect(borrowEnterGas(false)).toBe(BORROW_ENTER_NO_HINTS_GAS);
    expect(BORROW_ENTER_NO_HINTS_GAS).toBeGreaterThan(2_178_863n);
  });
});
