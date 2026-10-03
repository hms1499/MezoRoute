import { decodeFunctionData, erc20Abi, zeroHash } from "viem";
import { describe, expect, it } from "vitest";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { testnet } from "@/lib/config/testnet";
import {
  buildSpikeEnterParams,
  encodeApproveCall,
  encodeEnterCall,
  enterBlocker,
  needsApproval,
  netOfFee,
  NO_PERMIT,
  spikeSwapAmount,
} from "./spike";

const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";
const MUSD_20 = 20_000000000000000000n;

describe("spike entry params", () => {
  it("charges the fee before splitting, as the contract does (spec 11.3 step 5)", () => {
    expect(netOfFee(MUSD_20, 10n)).toBe(19_980000000000000000n);
    expect(spikeSwapAmount(MUSD_20, 10n)).toBe(9_990000000000000000n);
  });

  it("matches the live smoke entry and sets a 1% swap minimum and a 600 s deadline", () => {
    const params = buildSpikeEnterParams({
      musdIn: MUSD_20,
      feeBps: 10n,
      btcOutQuote: 126791217068156n,
      recipient: ME,
      nowSeconds: 1_790_900_000n,
    });
    expect(params).toEqual({
      musdIn: MUSD_20,
      musdToSwap: 9_990000000000000000n,
      minBtcFromSwap: 125523304897474n,
      minMusdAdded: 0n,
      minBtcAdded: 0n,
      minLpOut: 0n,
      deadline: 1_790_900_600n,
      recipient: ME,
    });
  });

  it("encodes enter(params, zero permit) with the deployed selector", () => {
    const params = buildSpikeEnterParams({
      musdIn: MUSD_20,
      feeBps: 10n,
      btcOutQuote: 1n,
      recipient: ME,
      nowSeconds: 0n,
    });
    const data = encodeEnterCall(params);
    expect(data.slice(0, 10)).toBe("0x92359033");
    const decoded = decodeFunctionData({ abi: mezoRouteExecutorAbi, data });
    expect(decoded.functionName).toBe("enter");
    expect(decoded.args).toEqual([params, { value: 0n, deadline: 0n, v: 0, r: zeroHash, s: zeroHash }]);
    expect(NO_PERMIT.value).toBe(0n);
  });

  it("encodes an exact approval to the executor", () => {
    const decoded = decodeFunctionData({ abi: erc20Abi, data: encodeApproveCall(testnet.addresses.executor, 5n) });
    expect(decoded.functionName).toBe("approve");
    expect(decoded.args).toEqual([testnet.addresses.executor, 5n]);
  });
});

describe("enterBlocker", () => {
  const ok = {
    amount: 10n,
    chainId: 31611,
    onchainFeeBps: 10n,
    musdBalance: 10n,
    gasBalance: 1n,
    maxMusdIn: 10n,
  };

  it("allows amounts equal to the balance and to the cap", () => {
    expect(enterBlocker(ok)).toBeNull();
  });

  // Expected value first: test titles format it with %s (JSON formatting cannot print bigint).
  it.each([
    ["wrong-network", { chainId: 1 }],
    ["wrong-network", { chainId: undefined }],
    ["config-mismatch", { onchainFeeBps: 50n }],
    ["enter-amount", { amount: null }],
    ["needs-gas", { gasBalance: 0n }],
    ["insufficient-musd", { musdBalance: 9n }],
    ["above-cap", { maxMusdIn: 9n }],
  ] as const)("returns %s", (expected, override) => {
    expect(enterBlocker({ ...ok, ...override })).toBe(expected);
  });

  it("reports the network before anything else", () => {
    expect(enterBlocker({ ...ok, chainId: 1, amount: null, gasBalance: 0n })).toBe("wrong-network");
  });
});

describe("needsApproval", () => {
  it("skips the approval when the allowance already covers the amount", () => {
    expect(needsApproval(10n, 10n)).toBe(false);
    expect(needsApproval(9n, 10n)).toBe(true);
  });
});
