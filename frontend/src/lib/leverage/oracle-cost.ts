import { WAD } from "@/lib/math";

const BPS = 10_000n;

export type SwapSide = "buyBtc" | "sellBtc";

/**
 * How much worse than the PriceFeed price a swap is, in bps, rounded up (never understated):
 * positive is a cost, negative beats the oracle. `musd` is paid (buy) or received (sell) for `btc`.
 */
export function oracleCostBps(side: SwapSide, musd: bigint, btc: bigint, price: bigint): bigint {
  const effective = (musd * WAD) / btc;
  const worse = side === "buyBtc" ? effective - price : price - effective;
  if (worse <= 0n) return -((-worse * BPS) / price);
  return (worse * BPS + price - 1n) / price;
}

/** MezoRouteLeverage's own oracle check, so the app never builds a swap the contract rejects. */
export function withinOracleBound(side: SwapSide, musd: bigint, btc: bigint, price: bigint, boundBps: bigint): boolean {
  return side === "buyBtc"
    ? musd * WAD * BPS <= btc * price * (BPS + boundBps)
    : btc * price * BPS <= musd * WAD * (BPS + boundBps);
}
