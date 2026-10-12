import { encodeFunctionData, type Address, type Hex } from "viem";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import type { ExitMinimums, ExitQuote } from "@/lib/quote/exit";
import { NO_PERMIT, type ExecutorPermit } from "@/lib/routes/musd-btc-lp/params";

/** The executor's ExitParams (spec 11.2). */
export type ExitParams = {
  liquidityIn: bigint;
  minMusdRemoved: bigint;
  minBtcRemoved: bigint;
  minMusdFromSwap: bigint;
  minMusdOut: bigint;
  deadline: bigint;
  recipient: Address;
};

/** ExitParams from a fresh quote; the recipient is always the caller's own account. */
export function buildExitParams(quote: ExitQuote, minimums: ExitMinimums, deadline: bigint, recipient: Address): ExitParams {
  return { liquidityIn: quote.liquidityIn, ...minimums, deadline, recipient };
}

export function encodeExitCall(params: ExitParams, permit: ExecutorPermit = NO_PERMIT): Hex {
  return encodeFunctionData({ abi: mezoRouteExecutorAbi, functionName: "exit", args: [params, permit] });
}
