import { zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { findHints, hintTrials, type HintRead } from "./hints";

const A = "0x00000000000000000000000000000000000000aa";
const B = "0x00000000000000000000000000000000000000bb";
const C = "0x00000000000000000000000000000000000000cc";

describe("hintTrials", () => {
  it("is 15 × ⌈√n⌉", () => {
    expect(hintTrials(242n)).toBe(240n);
    expect(hintTrials(225n)).toBe(225n);
    expect(hintTrials(1n)).toBe(15n);
    expect(hintTrials(0n)).toBe(0n);
  });
});

describe("findHints", () => {
  const input = { network: networks.testnet, nicr: 123n, troveCount: 242n, seed: 9n };

  it("asks HintHelpers for an approximate hint, then SortedTroves for the exact position", async () => {
    const calls: { functionName: string; args: readonly unknown[]; address: string }[] = [];
    const read: HintRead = async (call) => {
      calls.push(call);
      return call.functionName === "getApproxHint" ? [A, 0n, 1n] : [B, C];
    };
    await expect(findHints(read, input)).resolves.toEqual({ upperHint: B, lowerHint: C, found: true });
    expect(calls).toEqual([
      expect.objectContaining({ address: networks.testnet.addresses.hintHelpers, functionName: "getApproxHint", args: [123n, 240n, 9n] }),
      expect.objectContaining({ address: networks.testnet.addresses.sortedTroves, functionName: "findInsertPosition", args: [123n, A, A] }),
    ]);
  });

  it("falls back to zero hints when a read fails, so the send still goes through", async () => {
    const read: HintRead = async () => {
      throw new Error("RPC down");
    };
    await expect(findHints(read, input)).resolves.toEqual({ upperHint: zeroAddress, lowerHint: zeroAddress, found: false });
  });

  it("needs no reads without Troves", async () => {
    const read: HintRead = async () => {
      throw new Error("should not be called");
    };
    await expect(findHints(read, { ...input, troveCount: 0n })).resolves.toMatchObject({ found: false });
  });
});
