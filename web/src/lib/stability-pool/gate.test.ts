import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { spClaimBlock, spDepositBlock, spWithdrawBlock } from "./gate";

const ONE = 10n ** 18n;
const testnet = networks.testnet;
const deposit = (over: Partial<Parameters<typeof spDepositBlock>[0]> = {}) =>
  spDepositBlock({ network: testnet, walletChainId: 31611, musdIn: 10n * ONE, walletMusd: 10n * ONE, lacksGas: false, ...over });

describe("spDepositBlock", () => {
  it("passes a covered amount", () => {
    expect(deposit()).toBeNull();
  });

  it.each([
    [{ network: { ...networks.mainnet, executor: null }, walletChainId: 31612 }, "no-executor"],
    [{ walletChainId: 1 }, "wrong-network"],
    [{ musdIn: null }, "zero"],
    [{ musdIn: 10n * ONE + 1n }, "insufficient-balance"],
    [{ lacksGas: true }, "needs-gas"],
  ] as const)("case %#", (over, reason) => {
    expect(deposit(over)?.reason).toBe(reason);
  });

  it("keeps the button silently disabled before an amount is typed", () => {
    expect(deposit({ musdIn: null })?.outcome).toBeNull();
  });

  it("has no mainnet cap: the cap belongs to the executor", () => {
    expect(deposit({ musdIn: 5_000n * ONE, walletMusd: 5_000n * ONE })).toBeNull();
  });
});

describe("spWithdrawBlock", () => {
  const withdraw = (over: Partial<Parameters<typeof spWithdrawBlock>[0]> = {}) =>
    spWithdrawBlock({ network: testnet, walletChainId: 31611, initialDeposit: 10n * ONE, amount: 5n * ONE, lacksGas: false, ...over });

  it.each([
    [{}, null],
    [{ initialDeposit: 0n }, "no-deposit"],
    [{ amount: 0n }, "too-small"],
    [{ lacksGas: true }, "needs-gas"],
    [{ walletChainId: 1 }, "wrong-network"],
  ] as const)("case %#", (over, reason) => {
    expect(withdraw(over)?.reason ?? null).toBe(reason);
  });
});

describe("spClaimBlock", () => {
  const claim = (over: Partial<Parameters<typeof spClaimBlock>[0]> = {}) =>
    spClaimBlock({ network: testnet, walletChainId: 31611, initialDeposit: 10n * ONE, gain: 5n, lacksGas: false, ...over });

  it.each([
    [{}, null],
    [{ initialDeposit: 0n, gain: 0n }, "no-deposit"],
    [{ gain: 0n }, "no-gain"],
    [{ lacksGas: true }, "needs-gas"],
  ] as const)("case %#", (over, reason) => {
    expect(claim(over)?.reason ?? null).toBe(reason);
  });
});
