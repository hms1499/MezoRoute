import { encodeFunctionData, type Address, type Hex } from "viem";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import type { NetworkConfig } from "@/lib/config/networks";
import { encodeApproveCall } from "@/lib/routes/musd-btc-lp/params";

export function encodeProvideCall(amount: bigint): Hex {
  return encodeFunctionData({ abi: stabilityPoolAbi, functionName: "provideToSP", args: [amount] });
}

/** `withdrawFromSP(0)` is the BTC-gain claim: it pays the gain, keeps the deposit, and is never paused. */
export function encodeWithdrawCall(amount: bigint): Hex {
  return encodeFunctionData({ abi: stabilityPoolAbi, functionName: "withdrawFromSP", args: [amount] });
}

export function encodeSpApproveCall(network: NetworkConfig, amount: bigint): { to: Address; data: Hex } {
  return { to: network.addresses.musd, data: encodeApproveCall(network.addresses.stabilityPool, amount) };
}
