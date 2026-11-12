import { formatUnits } from "viem";

/**
 * Where the landing sends an amount. Both routes plan without a wallet (U13 the LP, U17 the Stability Pool). The
 * amount is written as a plain decimal, which both route pages parse; null (the simulator's example state) is the
 * bare page.
 */
export function plannerHref(route: "lp" | "sp", amount: bigint | null): string {
  const path = route === "lp" ? "/route/lp/" : "/route/stability-pool/";
  return amount === null ? path : `${path}?amount=${formatUnits(amount, 18)}`;
}
