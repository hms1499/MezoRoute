// U11 §6.3: the Dashboard's stats strip. The positions value is exactly what Positions totals (`positionTotals`), so
// the two pages never disagree; a failed gauge read gives null, never 0 (Review Focus 3).

import { exposure } from "@/lib/exposure/exposure";
import { formatBps, formatPercent } from "@/lib/format";
import type { StakeAvailability } from "@/lib/gauge/availability";
import { positionTotals } from "@/lib/positions/totals";
import type { PositionView } from "@/lib/positions/view";
import type { SpView } from "@/lib/stability-pool/position";
import { collateralRatio, type TroveHealth } from "@/lib/trove/health";
import { troveWarning } from "./readiness";
import type { DashboardSnapshot } from "./snapshot";

export type DashboardStats = {
  /** MUSD, as Positions totals it; null while it cannot be totalled (loading, or staked LP unreadable). */
  positionsValue: bigint | null;
  btcExposure: bigint;
  /** null when the gauge could not be read. */
  pendingMezo: bigint | null;
  troveCr: { value: bigint | null; atRisk: boolean } | "none";
};

export function dashboardStats(input: {
  snapshot: DashboardSnapshot;
  health: TroveHealth | null;
  totals: { view: PositionView; pool: SpView | null; gaugeReadFailed: boolean } | null;
}): DashboardStats {
  const { snapshot, health, totals } = input;
  return {
    positionsValue: totals ? (positionTotals(totals.view, totals.pool, totals.gaugeReadFailed)?.value ?? null) : null,
    btcExposure: exposure(snapshot).totalBtc,
    pendingMezo: snapshot.gaugeReadFailed ? null : (snapshot.gauge?.earned ?? 0n),
    troveCr: snapshot.trove
      ? { value: collateralRatio(snapshot.trove, snapshot.price), atRisk: troveWarning(health, snapshot.protocol.mcr) !== null }
      : "none",
  };
}

/** The LP route's returns: this week's APR while the week pays and a MEZO price is known, the pool's swap fee otherwise. */
export function lpReturns(input: { availability: StakeAvailability; apr: bigint | null; poolFeeBps: bigint }): string {
  if (input.availability === "open" && input.apr !== null) return `≈ ${formatPercent(input.apr, 1)} APR this week`;
  return `${formatBps(input.poolFeeBps)} swap fee`;
}
