import type { GaugeState } from "./state";

/** Gauge maths, all 1e18 fixed point. Display only: nothing here decides what is sent. */

const E18 = 10n ** 18n;
const SECONDS_PER_WEEK = 604_800n;
const SECONDS_PER_YEAR = 31_536_000n;
const Q192 = 2n ** 192n;

export type GaugePool = { reserveMusd: bigint; reserveBtc: bigint; balanceMusd: bigint; balanceBtc: bigint; totalSupply: bigint };

/** The week still pays: the gauge is alive and its reward period has not finished. */
export function gaugeWeekOpen(state: GaugeState, now: bigint): boolean {
  return state.alive && now < state.periodFinish;
}

/** MUSD value of `lp`, with the pool's BTC valued at the pool's own mid price (the F6 rule, not the oracle). */
export function lpValueInMusd(lp: bigint, pool: GaugePool): bigint {
  if (pool.totalSupply === 0n || pool.reserveBtc === 0n) return 0n;
  const btcInMusd = (pool.balanceBtc * pool.reserveMusd) / pool.reserveBtc;
  return (lp * (pool.balanceMusd + btcInMusd)) / pool.totalSupply;
}

/** MEZO the user would earn in a week at the current rate, diluted by their own deposit. */
export function mezoPerWeek(rewardRate: bigint, userLp: bigint, totalStaked: bigint): bigint {
  const denominator = totalStaked + userLp;
  if (denominator === 0n) return 0n;
  return (rewardRate * SECONDS_PER_WEEK * userLp) / denominator;
}

/** Emissions APR at this week's rate (1e18 = 100%); null without a MEZO price or any staked value. */
export function emissionsApr(input: {
  rewardRate: bigint;
  mezoPrice: bigint | null;
  userLp: bigint;
  totalStaked: bigint;
  pool: GaugePool;
}): bigint | null {
  if (input.mezoPrice === null || input.mezoPrice <= 0n) return null;
  const value = lpValueInMusd(input.totalStaked + input.userLp, input.pool);
  if (value === 0n) return null;
  const yearlyMusd = (input.rewardRate * SECONDS_PER_YEAR * input.mezoPrice) / E18;
  return (yearlyMusd * E18) / value;
}

/** MUSD per MEZO from a CL pool's `sqrtPriceX96` (token1 per token0 = (sqrtP / 2^96)^2); null when the pool has no price. */
export function mezoPriceFromSlot0(sqrtPriceX96: bigint, mezoIsToken0: boolean): bigint | null {
  const squared = sqrtPriceX96 * sqrtPriceX96;
  if (squared === 0n) return null;
  const price = mezoIsToken0 ? (squared * E18) / Q192 : (Q192 * E18) / squared;
  return price === 0n ? null : price;
}
