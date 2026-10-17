import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { HistoryLagError, historyLagging, historyStatus, shouldFetchHistory, spCostBasis } from "./cost-basis";
import type { SpAction } from "./history";

const ONE = 10n ** 18n;
const action = (kind: SpAction["kind"], amount: bigint, before: bigint, depositAfter: bigint, gain = 0n, loss = 0n): SpAction => ({
  kind,
  txHash: "0x01" as Hex,
  blockNumber: 1n,
  amount,
  gain,
  loss,
  before,
  depositAfter,
});

describe("spCostBasis", () => {
  it("is zero without history", () => {
    expect(spCostBasis([])).toEqual({ basis: 0n, gainsClaimed: 0n, lossRealised: 0n, lastDeposit: 0n });
  });

  it("adds deposits", () => {
    expect(spCostBasis([action("deposit", 25n * ONE, 0n, 25n * ONE), action("deposit", 5n * ONE, 25n * ONE, 30n * ONE)]).basis).toBe(30n * ONE);
  });

  it("removes cost pro rata after the deposit absorbed a loss", () => {
    const result = spCostBasis([
      action("deposit", 100n * ONE, 0n, 100n * ONE),
      action("withdraw", 40n * ONE, 80n * ONE, 40n * ONE, 5n, 20n * ONE),
    ]);
    expect(result).toEqual({ basis: 50n * ONE, gainsClaimed: 5n, lossRealised: 20n * ONE, lastDeposit: 40n * ONE });
  });

  it("adds a top-up made after the deposit absorbed a loss", () => {
    const result = spCostBasis([
      action("deposit", 100n * ONE, 0n, 100n * ONE),
      action("deposit", 30n * ONE, 80n * ONE, 110n * ONE, 2n, 20n * ONE),
    ]);
    expect(result).toEqual({ basis: 130n * ONE, gainsClaimed: 2n, lossRealised: 20n * ONE, lastDeposit: 110n * ONE });
  });

  it("clears the basis on a full withdrawal", () => {
    expect(spCostBasis([action("deposit", 10n * ONE, 0n, 10n * ONE), action("withdraw", 10n * ONE, 10n * ONE, 0n)]).basis).toBe(0n);
  });

  it("starts a new position after liquidations wiped the deposit out", () => {
    const result = spCostBasis([
      action("deposit", 100n * ONE, 0n, 100n * ONE),
      action("deposit", 50n * ONE, 0n, 50n * ONE, 5n, 100n * ONE),
    ]);
    expect(result).toEqual({ basis: 50n * ONE, gainsClaimed: 0n, lossRealised: 0n, lastDeposit: 50n * ONE });
  });

  it("starts a new position after a full withdrawal, without the old position's gains and losses", () => {
    const result = spCostBasis([
      action("deposit", 10n * ONE, 0n, 10n * ONE),
      action("withdraw", 9n * ONE, 9n * ONE, 0n, 2n, 1n * ONE),
      action("deposit", 20n * ONE, 0n, 20n * ONE),
    ]);
    expect(result).toEqual({ basis: 20n * ONE, gainsClaimed: 0n, lossRealised: 0n, lastDeposit: 20n * ONE });
  });

  it("keeps the basis on a claim and counts the gain", () => {
    const result = spCostBasis([action("deposit", 10n * ONE, 0n, 10n * ONE), action("claim", 0n, 10n * ONE, 10n * ONE, 3n)]);
    expect(result.basis).toBe(10n * ONE);
    expect(result.gainsClaimed).toBe(3n);
  });
});

describe("historyLagging", () => {
  it("flags history whose last deposit is not the on-chain deposit", () => {
    const basis = spCostBasis([action("deposit", 10n * ONE, 0n, 10n * ONE)]);
    expect(historyLagging(basis, 10n * ONE)).toBe(false);
    expect(historyLagging(basis, 25n * ONE)).toBe(true);
  });

  it("accepts an empty history for an account that never deposited", () => {
    expect(historyLagging(spCostBasis([]), 0n)).toBe(false);
  });
});

describe("historyStatus", () => {
  it.each([
    [{ hasData: true, error: null, failureReason: null }, "ready"],
    [{ hasData: false, error: new Error("x"), failureReason: new Error("x") }, "unavailable"],
    [{ hasData: false, error: null, failureReason: new HistoryLagError("lag") }, "updating"],
    [{ hasData: false, error: null, failureReason: null }, "loading"],
  ] as const)("%j → %s", (input, status) => {
    expect(historyStatus(input)).toBe(status);
  });
});

describe("shouldFetchHistory", () => {
  it.each([
    [undefined, false],
    [0n, false],
    [1n, true],
  ] as const)("deposits() %s → %s", (initialDeposit, fetch) => {
    expect(shouldFetchHistory(initialDeposit)).toBe(fetch);
  });
});
