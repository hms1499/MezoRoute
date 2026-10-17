import type { Series } from "@/lib/chart/move-chart";
import { lpMoveFactor, MOVES } from "@/lib/exposure/moves";
import { WAD } from "@/lib/math";
import type { LandingSimulation } from "./simulate";

const toMusd = (wei: bigint) => Number(wei) / 1e18;

/**
 * The landing hero's two lines (U3 §4.2): the LP moves with BTC (about half of it is BTC), the
 * Stability Pool stays at the deposit. Empty until the mainnet figures load.
 */
export function heroSeries(sim: LandingSimulation | null): Series[] {
  if (!sim) return [];
  const sp: Series = { id: "sp", points: MOVES.map((move) => ({ move, value: toMusd(sim.sp.positionValue) })) };
  if (sim.lp.status !== "ok") return [sp];
  const { positionValue } = sim.lp;
  const lp: Series = { id: "lp", points: MOVES.map((move) => ({ move, value: toMusd((positionValue * lpMoveFactor(move)) / WAD) })) };
  return [lp, sp];
}
