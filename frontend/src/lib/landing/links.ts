import { formatUnits } from "viem";

/**
 * U16: where the landing sends an amount. The LP route plans without a wallet (U13); the Stability Pool route asks
 * for one. The amount is written as a plain decimal, which both route pages parse.
 */
export function plannerHref(route: "lp" | "sp", amount: bigint): string {
  const path = route === "lp" ? "/route/lp/" : "/route/stability-pool/";
  return `${path}?amount=${formatUnits(amount, 18)}`;
}
