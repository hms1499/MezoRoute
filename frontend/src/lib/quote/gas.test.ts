import { describe, expect, it } from "vitest";
import { BORROW_ENTER_GAS, BORROW_ENTER_NO_HINTS_GAS, borrowEnterGas, gasLimit, SP_DEPOSIT_GAS, SP_WITHDRAW_GAS } from "./gas";

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

describe("Stability Pool gas budgets", () => {
  // Testnet estimates, 14 Oct 2026: withdrawFromSP(1) paying a 176 BTC gain 225,416; withdrawFromSP(5e18)
  // without a gain 146,084; provideToSP top-up without a gain 86,499.
  const WITHDRAW_WITH_GAIN = 225_416n;
  const GAIN_PAYOUT = WITHDRAW_WITH_GAIN - 146_084n;
  const DEPOSIT_TOP_UP = 86_499n;

  it("covers a withdrawal that pays a BTC gain, with the 20% margin a healthy estimate would get", () => {
    expect(SP_WITHDRAW_GAS).toBeGreaterThanOrEqual((WITHDRAW_WITH_GAIN * 12n) / 10n);
  });

  it("covers a deposit that also pays a BTC gain, with a 20% margin", () => {
    expect(SP_DEPOSIT_GAS).toBeGreaterThanOrEqual(((DEPOSIT_TOP_UP + GAIN_PAYOUT) * 12n) / 10n);
  });
});
