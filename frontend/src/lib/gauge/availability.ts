import { gaugeWeekOpen } from "./maths";
import type { GaugeState } from "./state";

/**
 * Whether the LP route can stake: "open" (alive, this week still pays), "between-weeks" (alive, the
 * period has finished and the next rate is not set yet; staking still works), or "unavailable" (the
 * voter no longer counts the gauge alive, or the network has none).
 */
export type StakeAvailability = "open" | "between-weeks" | "unavailable";

export function stakeAvailability(gauge: GaugeState | null, now: bigint): StakeAvailability {
  if (!gauge || !gauge.alive) return "unavailable";
  return gaugeWeekOpen(gauge, now) ? "open" : "between-weeks";
}

/** The stake flag actually sent: the user's choice, but never when staking is unavailable. */
export function effectiveStake(wanted: boolean, availability: StakeAvailability): boolean {
  return wanted && availability !== "unavailable";
}
