import { stakeAvailability, type StakeAvailability } from "@/lib/gauge/availability";
import { mezoPerWeek } from "@/lib/gauge/maths";
import type { SavingsState } from "./state";

const SECONDS_PER_YEAR = 31_536_000n;

/** This week's MEZO for staking `amount` sMUSD; figures only while the week pays (never a stale rate). */
export type SavingsWeek = { availability: StakeAvailability; mezoPerWeek: bigint | null; apr: bigint | null };

export function savingsWeek(input: { state: SavingsState; amount: bigint; now: bigint; mezoPrice: bigint | null }): SavingsWeek {
  const { gauge } = input.state;
  if (!gauge) return { availability: "unavailable", mezoPerWeek: null, apr: null };
  const availability = stakeAvailability({ ...gauge, staked: 0n, earned: 0n }, input.now);
  if (availability !== "open") return { availability, mezoPerWeek: null, apr: null };
  // sMUSD is MUSD 1:1, so the staked value is the staked amount.
  const staked = gauge.totalStaked + input.amount;
  const apr = input.mezoPrice === null || input.mezoPrice <= 0n || staked === 0n ? null : (gauge.rewardRate * SECONDS_PER_YEAR * input.mezoPrice) / staked;
  return { availability, mezoPerWeek: mezoPerWeek(gauge.rewardRate, input.amount, gauge.totalStaked), apr };
}

/** MUSD paid per sMUSD between two reads of the vault's index (1e18 = 100%): an unstaked holder's return. */
export function savingsReturn(pastIndex: bigint, nowIndex: bigint): bigint {
  return nowIndex - pastIndex;
}
