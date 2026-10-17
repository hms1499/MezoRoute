import { decodeFunctionData, erc20Abi, getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import { networks } from "@/lib/config/networks";
import { encodeProvideCall, encodeSpApproveCall, encodeWithdrawCall } from "./calls";
import { spDepositSteps } from "./steps";

describe("Stability Pool calls", () => {
  it("round-trips provideToSP and withdrawFromSP (a claim is withdrawFromSP(0))", () => {
    expect(decodeFunctionData({ abi: stabilityPoolAbi, data: encodeProvideCall(7n) })).toEqual({ functionName: "provideToSP", args: [7n] });
    expect(decodeFunctionData({ abi: stabilityPoolAbi, data: encodeWithdrawCall(0n) })).toEqual({ functionName: "withdrawFromSP", args: [0n] });
  });

  it("approves exactly the amount for the pool on the MUSD token", () => {
    const call = encodeSpApproveCall(networks.testnet, 9n);
    expect(call.to).toBe(networks.testnet.addresses.musd);
    expect(decodeFunctionData({ abi: erc20Abi, data: call.data }).args).toEqual([getAddress(networks.testnet.addresses.stabilityPool), 9n]);
  });
});

describe("spDepositSteps", () => {
  it.each([
    [0n, 5n, ["approve", "deposit"]],
    [4n, 5n, ["approve", "deposit"]],
    [5n, 5n, ["deposit"]],
  ] as const)("allowance %s for %s → %j", (allowance, amount, steps) => {
    expect(spDepositSteps(allowance, amount)).toEqual(steps);
  });
});
