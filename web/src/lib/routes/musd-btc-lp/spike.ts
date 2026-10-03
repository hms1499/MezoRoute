import { encodeFunctionData, erc20Abi, zeroHash, type Address, type Hex } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { testnet } from "@/lib/config/testnet";

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

/** Permit with value 0: the executor skips the permit and uses the existing allowance (spec 11.2). */
export const NO_PERMIT = { value: 0n, deadline: 0n, v: 0, r: zeroHash, s: zeroHash } as const;

/** Transaction deadline, now + 10 minutes (spec §12). */
export const DEADLINE_SECONDS = 600n;
/** Default slippage, 1% (spec §12). */
export const SPIKE_SLIPPAGE_BPS = 100n;

export function netOfFee(musdIn: bigint, feeBps: bigint): bigint {
  return musdIn - (musdIn * feeBps) / 10_000n;
}

/**
 * S1 only: swap half of the post-fee amount, like the testnet smoke script. The optimal-swap
 * quote engine with full minimums (spec §12, task F3) replaces this.
 */
export function spikeSwapAmount(musdIn: bigint, feeBps: bigint): bigint {
  return netOfFee(musdIn, feeBps) / 2n;
}

export function buildSpikeEnterParams(input: {
  musdIn: bigint;
  feeBps: bigint;
  btcOutQuote: bigint;
  recipient: Address;
  nowSeconds: bigint;
}): EnterParams {
  return {
    musdIn: input.musdIn,
    musdToSwap: spikeSwapAmount(input.musdIn, input.feeBps),
    minBtcFromSwap: (input.btcOutQuote * (10_000n - SPIKE_SLIPPAGE_BPS)) / 10_000n,
    minMusdAdded: 0n,
    minBtcAdded: 0n,
    minLpOut: 0n,
    deadline: input.nowSeconds + DEADLINE_SECONDS,
    recipient: input.recipient,
  };
}

export function encodeEnterCall(params: EnterParams): Hex {
  return encodeFunctionData({ abi: mezoRouteExecutorAbi, functionName: "enter", args: [params, NO_PERMIT] });
}

export function encodeApproveCall(spender: Address, amount: bigint): Hex {
  return encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] });
}

export type EnterBlocker =
  | "wrong-network"
  | "config-mismatch"
  | "enter-amount"
  | "needs-gas"
  | "insufficient-musd"
  | "above-cap";

export const ENTER_BLOCKER_MESSAGES: Record<EnterBlocker, string> = {
  "wrong-network": "MezoRoute executes on Mezo Testnet.",
  "config-mismatch": "The executor on chain does not match this app's pinned fee.",
  "enter-amount": "Enter an MUSD amount.",
  "needs-gas": "You need test BTC to submit transactions.",
  "insufficient-musd": "Amount exceeds your available MUSD.",
  "above-cap": "Amount is above the executor's per-transaction cap.",
};

/** First reason the entry cannot be sent, in the order the user should fix them (spec FR-01, FR-05, FR-22). */
export function enterBlocker(state: {
  amount: bigint | null;
  chainId: number | undefined;
  onchainFeeBps: bigint;
  musdBalance: bigint;
  gasBalance: bigint;
  maxMusdIn: bigint;
}): EnterBlocker | null {
  if (state.chainId !== testnet.chainId) return "wrong-network";
  if (state.onchainFeeBps !== testnet.executorFeeBps) return "config-mismatch";
  if (state.amount === null) return "enter-amount";
  if (state.gasBalance === 0n) return "needs-gas";
  if (state.amount > state.musdBalance) return "insufficient-musd";
  if (state.amount > state.maxMusdIn) return "above-cap";
  return null;
}

export function needsApproval(allowance: bigint, amount: bigint): boolean {
  return allowance < amount;
}
