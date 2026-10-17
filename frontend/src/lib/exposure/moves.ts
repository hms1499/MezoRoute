import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { isqrt, WAD } from "@/lib/math";
import { collateralRatio, liquidationPrice } from "@/lib/trove/health";
import type { Exposure } from "./exposure";

/** BTC price moves on the "If BTC moves" chart (U3 §4.1): −30% to +30% in 5% steps. */
export const MOVES: readonly number[] = [-30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30];

const RANGE = 30;

/** The constant-product LP value factor after a BTC move, as a WAD: √(1 + move). `lpValueAfterDrop` for both directions. */
export function lpMoveFactor(movePercent: number): bigint {
  return isqrt((BigInt(100 + movePercent) * WAD * WAD) / 100n);
}

export type MoveScenario = { move: number; price: bigint; lpValue: bigint; spValue: bigint; collateralRatio: bigint | null };

/** Every position's value at each BTC move, all rounded down (the chart's data; the drawdown table stays `drawdownScenarios`). */
export function moveScenarios(snapshot: DashboardSnapshot, current: Exposure, moves: readonly number[] = MOVES): MoveScenario[] {
  return moves.map((move) => {
    const price = (snapshot.price * BigInt(100 + move)) / 100n;
    return {
      move,
      price,
      lpValue: (current.lpValue * lpMoveFactor(move)) / WAD,
      spValue: current.spDeposit + (current.spBtcGain * price) / WAD,
      collateralRatio: snapshot.trove ? collateralRatio(snapshot.trove, price) : null,
    };
  });
}

/**
 * Where the Trove reaches the MCR on the chart: the liquidation price and its move from today's price
 * (to 0.1%, rounded toward zero). Null without a Trove, or when that price lies beyond a 30% move.
 */
export function mcrCrossing(snapshot: DashboardSnapshot): { price: bigint; move: number } | null {
  if (!snapshot.trove) return null;
  const price = liquidationPrice(snapshot.trove, snapshot.protocol.mcr);
  if (price === null) return null;
  const move = Number(((price - snapshot.price) * 1000n) / snapshot.price) / 10;
  return Math.abs(move) <= RANGE ? { price, move } : null;
}
