import { gaugeWeekOpen } from "./maths";
import type { GaugeState } from "./state";

/**
 * Weeks are funded when an epoch flips, so a week and a late day explain a finished period. Past that nobody is funding the
 * gauge, and staking by default would leave a depositor with no MEZO and no swap fees (Ruling P22). The cost: the toggle hides
 * if a distribution runs more than a day late.
 */
export const UNFUNDED_AFTER_SECONDS = 8n * 24n * 60n * 60n;

/**
 * Whether the LP route can stake: "open" (alive, this week still pays), "between-weeks" (alive, the
 * period has finished and the next rate is not set yet; staking still works), or "unavailable" (the
 * voter no longer counts the gauge alive, nobody has funded it for over `UNFUNDED_AFTER_SECONDS`,
 * the network has none, or its reads failed).
 */
export type StakeAvailability = "open" | "between-weeks" | "unavailable";

export function stakeAvailability(gauge: GaugeState | null, now: bigint): StakeAvailability {
  if (!gauge || !gauge.alive) return "unavailable";
  if (gaugeWeekOpen(gauge, now)) return "open";
  return now - gauge.periodFinish > UNFUNDED_AFTER_SECONDS ? "unavailable" : "between-weeks";
}

/** The stake flag actually sent: the user's choice, but never when staking is unavailable. */
export function effectiveStake(wanted: boolean, availability: StakeAvailability): boolean {
  return wanted && availability !== "unavailable";
}

/** Whether Positions shows the gauge card: something is staked or pending (claim and unstake always work), or wallet LP could be staked. */
export function showsGaugeCard(gauge: GaugeState | null, walletLp: bigint, now: bigint): gauge is GaugeState {
  return gauge !== null && (gauge.staked > 0n || gauge.earned > 0n || (walletLp > 0n && stakeAvailability(gauge, now) !== "unavailable"));
}
