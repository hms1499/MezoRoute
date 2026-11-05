import { decodeFunctionData, erc20Abi, getAbiItem, toFunctionSelector, zeroHash } from "viem";
import { describe, expect, it } from "vitest";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { networks } from "@/lib/config/networks";
import { btcEntryMinimums, entryMinimums, quoteEntry, quoteEntryFromBtc } from "@/lib/quote/entry";
import {
  approveCall,
  buildBorrow,
  buildEnterFromBtcParams,
  buildEnterParams,
  DEADLINE_SECONDS,
  encodeApproveCall,
  encodeBorrowAndEnterCall,
  encodeEnterCall,
  encodeEnterFromBtcCall,
  needsApproval,
  netOfFee,
  NO_PERMIT,
  type EnterParams,
} from "./params";
import { ONE, TESTNET_POOL } from "./test-fixtures";

const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";
const EXECUTOR = "0xB36B2E012003840951CFf00fA6b1E3237A110920";
const MUSD_20 = 20_000000000000000000n;

describe("entry params", () => {
  it("charges the fee before splitting, as the contract does (spec 11.3 step 5)", () => {
    expect(netOfFee(MUSD_20, 10n)).toBe(19_980000000000000000n);
  });

  it("encodes enter(params, zero permit) with the deployed V2 selector", () => {
    const params: EnterParams = {
      musdIn: MUSD_20,
      musdToSwap: 9_990000000000000000n,
      minBtcFromSwap: 1n,
      minMusdAdded: 0n,
      minBtcAdded: 0n,
      minLpOut: 0n,
      deadline: DEADLINE_SECONDS,
      recipient: ME,
      stake: false,
    };
    const data = encodeEnterCall(params);
    expect(data.slice(0, 10)).toBe("0xc027e8cb");
    const decoded = decodeFunctionData({ abi: mezoRouteExecutorAbi, data });
    expect(decoded.functionName).toBe("enter");
    expect(decoded.args).toEqual([params, { value: 0n, deadline: 0n, v: 0, r: zeroHash, s: zeroHash }]);
    expect(NO_PERMIT.value).toBe(0n);
  });

  it("encodes an exact approval to the executor", () => {
    const decoded = decodeFunctionData({ abi: erc20Abi, data: encodeApproveCall(EXECUTOR, 5n) });
    expect(decoded.functionName).toBe("approve");
    expect(decoded.args).toEqual([EXECUTOR, 5n]);
  });
});

describe("needsApproval", () => {
  it("skips the approval when the allowance already covers the amount", () => {
    expect(needsApproval(10n, 10n)).toBe(false);
    expect(needsApproval(9n, 10n)).toBe(true);
  });
});

describe("buildEnterParams", () => {
  it("copies the quote's amounts and the minimums, with the deadline and recipient", () => {
    const quote = quoteEntry(TESTNET_POOL, 100n * ONE, 10n)!;
    const minimums = entryMinimums(quote, 100n);
    expect(buildEnterParams(quote, minimums, 1_759_600_600n, ME, false)).toEqual({
      musdIn: 100n * ONE,
      musdToSwap: quote.musdToSwap,
      ...minimums,
      deadline: 1_759_600_600n,
      recipient: ME,
      stake: false,
    });
  });
});

describe("encodeEnterCall with a permit", () => {
  it("encodes the signed permit as the second argument", () => {
    const params: EnterParams = {
      musdIn: MUSD_20,
      musdToSwap: 9_990000000000000000n,
      minBtcFromSwap: 1n,
      minMusdAdded: 0n,
      minBtcAdded: 0n,
      minLpOut: 0n,
      deadline: DEADLINE_SECONDS,
      recipient: ME,
      stake: false,
    };
    const permit = { value: MUSD_20, deadline: 99n, v: 27, r: `0x${"11".repeat(32)}`, s: `0x${"22".repeat(32)}` } as const;
    const decoded = decodeFunctionData({ abi: mezoRouteExecutorAbi, data: encodeEnterCall(params, permit) });
    expect(decoded.args).toEqual([params, permit]);
  });
});

describe("borrowAndEnter call", () => {
  it("builds the Borrow struct from the authorisation and hints, and encodes all three arguments", () => {
    const auth = { amount: MUSD_20, nonce: 2n, deadline: 99n, signature: `0x${"ab".repeat(65)}` } as const;
    const hints = { upperHint: EXECUTOR, lowerHint: ME, found: true } as const;
    const borrow = buildBorrow(auth, hints);
    expect(borrow).toEqual({ amount: MUSD_20, upperHint: EXECUTOR, lowerHint: ME, signature: auth.signature, deadline: 99n });
    const params: EnterParams = {
      musdIn: MUSD_20,
      musdToSwap: 9_990000000000000000n,
      minBtcFromSwap: 1n,
      minMusdAdded: 0n,
      minBtcAdded: 0n,
      minLpOut: 0n,
      deadline: 99n,
      recipient: ME,
      stake: false,
    };
    const decoded = decodeFunctionData({ abi: mezoRouteExecutorAbi, data: encodeBorrowAndEnterCall(borrow, params) });
    expect(decoded.functionName).toBe("borrowAndEnter");
    expect(decoded.args).toEqual([borrow, NO_PERMIT, params]);
  });
});

describe("stake in EnterParams", () => {
  it("sends stake in EnterParams and decodes back", () => {
    const quote = quoteEntry(TESTNET_POOL, MUSD_20, 10n)!;
    const params = buildEnterParams(quote, entryMinimums(quote, 100n), DEADLINE_SECONDS, ME, true);
    expect(params.stake).toBe(true);
    const decoded = decodeFunctionData({ abi: mezoRouteExecutorAbi, data: encodeEnterCall(params) });
    expect((decoded.args?.[0] as EnterParams).stake).toBe(true);
    expect(buildEnterParams(quote, entryMinimums(quote, 100n), DEADLINE_SECONDS, ME, false).stake).toBe(false);
  });
});

describe("enterFromBtc params", () => {
  const quote = quoteEntryFromBtc(TESTNET_POOL, 3n * 10n ** 14n, 10n)!;
  const minimums = btcEntryMinimums(quote, 100n);

  it("builds the nine EnterFromBtcParams fields from a quote", () => {
    expect(buildEnterFromBtcParams(quote, minimums, 1_700n, ME, true)).toEqual({
      btcIn: quote.btcIn,
      btcToSwap: quote.btcToSwap,
      minMusdFromSwap: minimums.minMusdFromSwap,
      minMusdAdded: minimums.minMusdAdded,
      minBtcAdded: minimums.minBtcAdded,
      minLpOut: minimums.minLpOut,
      deadline: 1_700n,
      recipient: ME,
      stake: true,
    });
  });

  it("encodes enterFromBtc(params, permit) with the deployed V2 selector", () => {
    const params = buildEnterFromBtcParams(quote, minimums, 1_700n, ME, false);
    const data = encodeEnterFromBtcCall(params);
    const decoded = decodeFunctionData({ abi: mezoRouteExecutorAbi, data });
    expect(decoded.functionName).toBe("enterFromBtc");
    expect(decoded.args).toEqual([params, NO_PERMIT]);
    expect(data.slice(0, 10)).toBe(toFunctionSelector(getAbiItem({ abi: mezoRouteExecutorAbi, name: "enterFromBtc" })));
  });

  it("smart accounts approve BTC exactly", () => {
    const call = approveCall(networks.testnet.addresses.btc, EXECUTOR, 5n);
    expect(call.to).toBe(networks.testnet.addresses.btc);
    const decoded = decodeFunctionData({ abi: erc20Abi, data: call.data });
    expect(decoded).toEqual({ functionName: "approve", args: [EXECUTOR, 5n] });
  });
});
