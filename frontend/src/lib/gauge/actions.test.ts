import { decodeFunctionData, encodeAbiParameters, getAbiItem, toEventSelector, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { gaugeAbi } from "@/lib/abi/gauge";
import { networks } from "@/lib/config/networks";
import { GAUGE_CLAIM_GAS, GAUGE_DEPOSIT_GAS, GAUGE_WITHDRAW_GAS } from "@/lib/quote/gas";
import { encodeGaugeCall, findRewardEvent, gaugeActionBlock } from "./actions";
import type { GaugeState } from "./state";

const testnet = networks.testnet;
const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";
const topic = (address: string) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}` as Hex;
const state = (overrides: Partial<GaugeState> = {}): GaugeState => ({
  alive: true,
  rewardRate: 1n,
  periodFinish: 2_000_000_000n,
  totalStaked: 10n,
  staked: 5n,
  earned: 3n,
  ...overrides,
});
const input = (action: "claim" | "stake" | "unstake", overrides: Partial<Parameters<typeof gaugeActionBlock>[0]> = {}) => ({
  network: testnet,
  walletChainId: testnet.chainId,
  action,
  state: state(),
  walletLp: 2n,
  lacksGas: false,
  ...overrides,
});

describe("gaugeActionBlock", () => {
  it("lets each action through when it has something to do", () => {
    for (const action of ["claim", "stake", "unstake"] as const) expect(gaugeActionBlock(input(action))).toBeNull();
  });

  it("blocks claim at zero earned; stake at zero wallet LP; unstake at zero staked", () => {
    expect(gaugeActionBlock(input("claim", { state: state({ earned: 0n }) }))?.reason).toBe("nothing-to-do");
    expect(gaugeActionBlock(input("stake", { walletLp: 0n }))?.reason).toBe("nothing-to-do");
    expect(gaugeActionBlock(input("unstake", { state: state({ staked: 0n }) }))?.reason).toBe("nothing-to-do");
  });

  it("blocks stake, but not claim or unstake, when the gauge is no longer alive", () => {
    const dead = state({ alive: false });
    expect(gaugeActionBlock(input("stake", { state: dead }))?.outcome.message).toMatch(/closed/i);
    expect(gaugeActionBlock(input("claim", { state: dead }))).toBeNull();
    expect(gaugeActionBlock(input("unstake", { state: dead }))).toBeNull();
  });

  it("blocks on the wrong network, on a read-only network, and without gas, in that order", () => {
    expect(gaugeActionBlock(input("claim", { walletChainId: 1, lacksGas: true }))?.reason).toBe("wrong-network");
    expect(gaugeActionBlock(input("claim", { network: { ...testnet, executor: null } }))?.reason).toBe("no-executor");
    expect(gaugeActionBlock(input("claim", { state: state({ earned: 0n }), lacksGas: true }))?.reason).toBe("nothing-to-do");
    expect(gaugeActionBlock(input("claim", { lacksGas: true }))?.reason).toBe("needs-gas");
  });
});

describe("encodeGaugeCall", () => {
  it("encodes getReward(account), deposit(amount), and withdraw(amount)", () => {
    const decode = (data: Hex) => decodeFunctionData({ abi: gaugeAbi, data });
    expect(decode(encodeGaugeCall({ action: "claim", account: ME }))).toMatchObject({ functionName: "getReward", args: [ME] });
    expect(decode(encodeGaugeCall({ action: "stake", amount: 7n }))).toMatchObject({ functionName: "deposit", args: [7n] });
    expect(decode(encodeGaugeCall({ action: "unstake", amount: 9n }))).toMatchObject({ functionName: "withdraw", args: [9n] });
  });
});

describe("gauge gas budgets", () => {
  it("are the highest measured gas plus 5%, rounded up to 5,000 (PRODUCT_SPEC §20)", () => {
    expect(GAUGE_DEPOSIT_GAS).toBe(145_000n); // 142,295
    expect(GAUGE_WITHDRAW_GAS).toBe(140_000n); // 130,620
    expect(GAUGE_CLAIM_GAS).toBe(65_000n); // 58,168
  });
});

describe("findRewardEvent", () => {
  const gauge = testnet.gauge!.address;
  const claim = {
    address: gauge,
    topics: [
      toEventSelector(getAbiItem({ abi: gaugeAbi, name: "ClaimRewards" })),
      topic(ME),
    ] as Hex[],
    data: encodeAbiParameters([{ type: "uint256" }], [123n]),
  };

  it("finds the gauge's ClaimRewards amount", () => {
    expect(findRewardEvent([claim], gauge)).toEqual({ amount: 123n });
  });

  it("ignores the same event from another address, and unrelated logs", () => {
    expect(findRewardEvent([{ ...claim, address: ME }], gauge)).toBeNull();
    expect(findRewardEvent([], gauge)).toBeNull();
  });
});
