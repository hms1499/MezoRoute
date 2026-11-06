import { describe, expect, it } from "vitest";
import { ENTER_BTC_GAS, EXIT_GAS, ENTER_BTC_STAKE_GAS, entryGasUnits, ENTER_GAS, ENTER_STAKE_GAS, STAKE_EXTRA_GAS, BORROW_ENTER_GAS, BORROW_ENTER_NO_HINTS_GAS, borrowEnterGas, gasLimit, SP_DEPOSIT_GAS, SP_WITHDRAW_GAS } from "./gas";

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

describe("entryGasUnits with staking", () => {
  it("uses the measured budget: the mainnet estimate 682,215 plus 5%, up to a multiple of 5,000", () => {
    expect(ENTER_STAKE_GAS).toBe(720_000n);
    expect(ENTER_STAKE_GAS).toBeGreaterThanOrEqual((682_215n * 105n) / 100n); // mainnet V2, first stake (6 Nov 2026)
    expect(STAKE_EXTRA_GAS).toBe(200_000n);
    expect(STAKE_EXTRA_GAS).toBeGreaterThanOrEqual(((682_215n - 496_365n) * 105n) / 100n); // same mainnet entry, stake on vs off
    expect(entryGasUnits({ approve: false, smartAccount: false, stake: true })).toBe(ENTER_STAKE_GAS);
    expect(entryGasUnits({ approve: false, smartAccount: false, stake: false })).toBe(ENTER_GAS);
  });

  it("adds the gauge deposit to a borrow entry", () => {
    expect(entryGasUnits({ approve: false, smartAccount: false, borrow: true, stake: true })).toBe(BORROW_ENTER_GAS + STAKE_EXTRA_GAS);
  });
});

describe("BTC entry gas budgets", () => {
  it("budgets enterFromBtc: max(used 383,737, estimate 439,723) plus 5%, up to a multiple of 5,000", () => {
    expect(ENTER_BTC_GAS).toBe(465_000n);
    expect(ENTER_BTC_GAS).toBeGreaterThanOrEqual((439_723n * 105n) / 100n);
    expect(ENTER_BTC_STAKE_GAS).toBe(540_000n);
    expect(ENTER_BTC_STAKE_GAS).toBeGreaterThanOrEqual((511_863n * 105n) / 100n); // mainnet V2 (6 Nov 2026)
  });

  it("estimates the whole BTC flow by asset", () => {
    expect(entryGasUnits({ approve: false, smartAccount: false, asset: "btc" })).toBe(ENTER_BTC_GAS);
    expect(entryGasUnits({ approve: false, smartAccount: false, asset: "btc", stake: true })).toBe(ENTER_BTC_STAKE_GAS);
    expect(entryGasUnits({ approve: true, smartAccount: false, asset: "btc" })).toBe(ENTER_BTC_GAS + 60_000n);
  });
});

describe("mainnet-measured budgets (Ruling P19)", () => {
  it("covers the real mainnet estimates plus 5%: V2 enter 496,365 and exit 491,297", () => {
    expect(ENTER_GAS).toBe(525_000n);
    expect(ENTER_GAS).toBeGreaterThanOrEqual((496_365n * 105n) / 100n);
    expect(EXIT_GAS).toBe(520_000n);
    expect(EXIT_GAS).toBeGreaterThanOrEqual((491_297n * 105n) / 100n);
  });
});
