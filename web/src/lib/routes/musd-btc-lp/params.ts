import { encodeFunctionData, erc20Abi, zeroHash, type Address, type Hex } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import type { EntryMinimums, EntryQuote } from "@/lib/quote/entry";
import type { BorrowAuthorisation } from "@/lib/trove/borrow-signature";
import type { Hints } from "@/lib/trove/hints";

export type EnterParams = {
  musdIn: bigint;
  musdToSwap: bigint;
  minBtcFromSwap: bigint;
  minMusdAdded: bigint;
  minBtcAdded: bigint;
  minLpOut: bigint;
  deadline: bigint;
  recipient: Address;
};

/** The executor's Permit struct (spec 11.2); value 0 skips the permit. */
export type ExecutorPermit = { value: bigint; deadline: bigint; v: number; r: Hex; s: Hex };

/** Permit with value 0: the executor skips the permit and uses the existing allowance (spec 11.2). */
export const NO_PERMIT = { value: 0n, deadline: 0n, v: 0, r: zeroHash, s: zeroHash } as const;

/** Transaction deadline, now + 10 minutes (spec §12). */
export const DEADLINE_SECONDS = 600n;

/** The executor charges its fee before splitting the input (spec 11.3 step 5). */
export function netOfFee(musdIn: bigint, feeBps: bigint): bigint {
  return musdIn - (musdIn * feeBps) / 10_000n;
}

export function encodeEnterCall(params: EnterParams, permit: ExecutorPermit = NO_PERMIT): Hex {
  return encodeFunctionData({ abi: mezoRouteExecutorAbi, functionName: "enter", args: [params, permit] });
}

/** EnterParams from a fresh quote; the recipient is always the caller's own account. */
export function buildEnterParams(
  quote: EntryQuote,
  minimums: EntryMinimums,
  deadline: bigint,
  recipient: Address,
): EnterParams {
  return { musdIn: quote.musdIn, musdToSwap: quote.musdToSwap, ...minimums, deadline, recipient };
}

/** The executor's Borrow struct (spec 11.2). */
export type BorrowCall = { amount: bigint; upperHint: Address; lowerHint: Address; signature: Hex; deadline: bigint };

export function buildBorrow(auth: BorrowAuthorisation, hints: Hints): BorrowCall {
  return {
    amount: auth.amount,
    upperHint: hints.upperHint,
    lowerHint: hints.lowerHint,
    signature: auth.signature,
    deadline: auth.deadline,
  };
}

export function encodeBorrowAndEnterCall(borrow: BorrowCall, params: EnterParams, permit: ExecutorPermit = NO_PERMIT): Hex {
  return encodeFunctionData({ abi: mezoRouteExecutorAbi, functionName: "borrowAndEnter", args: [borrow, permit, params] });
}

export function encodeApproveCall(spender: Address, amount: bigint): Hex {
  return encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] });
}

export function needsApproval(allowance: bigint, amount: bigint): boolean {
  return allowance < amount;
}
