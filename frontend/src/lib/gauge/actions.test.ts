import { decodeFunctionData, encodeAbiParameters, getAbiItem, toEventSelector, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { gaugeAbi } from "@/lib/abi/gauge";
import { networks } from "@/lib/config/networks";
import { GAUGE_CLAIM_GAS, GAUGE_DEPOSIT_GAS, GAUGE_WITHDRAW_GAS } from "@/lib/quote/gas";
import { BlockedError } from "@/lib/tx/errors";
import { encodeGaugeCall, findRewardEvent, gaugeActionBlock, gaugeForAction } from "./actions";
import { UNFUNDED_AFTER_SECONDS } from "./availability";
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
  now: 1_999_999_000n,
  ...overrides,
});

describe("gaugeForAction", () => {
  it("returns the gauge's state", () => {
    expect(gaugeForAction({ gauge: state(), gaugeReadFailed: false })).toEqual(state());
  });

  it("asks for a retry when the read failed, rather than say there is no gauge", () => {
    expect.assertions(2);
    try {
      gaugeForAction({ gauge: null, gaugeReadFailed: true });
    } catch (error) {
      expect(error).toBeInstanceOf(BlockedError);
      expect((error as BlockedError).outcome.recovery).toEqual(["retry"]);
    }
  });

  it("is an error on a network with no gauge", () => {
    expect(() => gaugeForAction({ gauge: null, gaugeReadFailed: false })).toThrow("This network has no gauge");
  });
});

describe("gaugeActionBlock", () => {
  it("offers no stake on an alive gauge nobody funds, while claim and unstake still work", () => {
    const unfunded = input("stake", { now: 2_000_000_000n + UNFUNDED_AFTER_SECONDS + 1n });
    expect(gaugeActionBlock(unfunded)?.outcome.kind).toBe("staking-closed");
    expect(gaugeActionBlock({ ...unfunded, action: "claim" })).toBeNull();
    expect(gaugeActionBlock({ ...unfunded, action: "unstake" })).toBeNull();
  });

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
  it("are max(highest gasUsed, highest healthy estimate) plus 5%, rounded up to 5,000 (Ruling P15)", () => {
    expect(GAUGE_DEPOSIT_GAS).toBe(165_000n); // estimate 154,522
    expect(GAUGE_WITHDRAW_GAS).toBe(155_000n); // estimate 147,097, used 137,316
    expect(GAUGE_CLAIM_GAS).toBe(90_000n); // mainnet estimate 85,049 (6 Nov 2026)
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
