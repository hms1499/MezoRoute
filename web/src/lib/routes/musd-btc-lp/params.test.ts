import { decodeFunctionData, erc20Abi, zeroHash } from "viem";
import { describe, expect, it } from "vitest";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import {
  DEADLINE_SECONDS,
  encodeApproveCall,
  encodeEnterCall,
  needsApproval,
  netOfFee,
  NO_PERMIT,
  type EnterParams,
} from "./params";

const ME = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49";
const EXECUTOR = "0xB36B2E012003840951CFf00fA6b1E3237A110920";
const MUSD_20 = 20_000000000000000000n;

describe("entry params", () => {
  it("charges the fee before splitting, as the contract does (spec 11.3 step 5)", () => {
    expect(netOfFee(MUSD_20, 10n)).toBe(19_980000000000000000n);
  });

  it("encodes enter(params, zero permit) with the deployed selector", () => {
    const params: EnterParams = {
      musdIn: MUSD_20,
      musdToSwap: 9_990000000000000000n,
      minBtcFromSwap: 1n,
      minMusdAdded: 0n,
      minBtcAdded: 0n,
      minLpOut: 0n,
      deadline: DEADLINE_SECONDS,
      recipient: ME,
    };
    const data = encodeEnterCall(params);
    expect(data.slice(0, 10)).toBe("0x92359033");
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
