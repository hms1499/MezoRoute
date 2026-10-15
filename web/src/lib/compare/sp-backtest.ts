import { WAD } from "@/lib/math";

/** StabilityPool.SCALE_FACTOR on Mezo (read on mainnet, 15 Oct 2026). */
export const SCALE_FACTOR = 10n ** 9n;

/** A deposit's snapshot at the past block: the pool's running product P, sum S, epoch, and scale. */
export type SpPast = { P: bigint; S: bigint; epoch: bigint; scale: bigint };
/** The pool today, with the sums at the past snapshot's scale and the next one. */
export type SpNow = { P: bigint; epoch: bigint; scale: bigint; sumAtPastScale: bigint; sumAtNextScale: bigint };

export type SpBacktest = {
  depositNow: bigint; // compounded deposit, MUSD
  btcGain: bigint;
  valueNow: bigint; // MUSD: depositNow + btcGain at today's price
  gainReturn: bigint; // BTC gain value / amount, 1e18 = 100%
  lossReturn: bigint; // debt absorbed / amount
  liquidated: boolean; // a liquidation reached the pool in the window
};

/**
 * What `amount` MUSD deposited at the past block would be today: Liquity v1's
 * getCompoundedStakeFromSnapshots and getDepositorCollateralGain (spec F6 §1), all divisions rounding down.
 */
export function spBacktest(input: { past: SpPast; now: SpNow; price: bigint; amount: bigint }): SpBacktest {
  const { past, now, price, amount } = input;
  const firstPortion = now.sumAtPastScale - past.S;
  const secondPortion = now.sumAtNextScale / SCALE_FACTOR;
  const btcGain = (amount * (firstPortion + secondPortion)) / past.P / WAD;
  const depositNow = compounded(amount, past, now);
  const gainValue = (btcGain * price) / WAD;
  return {
    depositNow,
    btcGain,
    valueNow: depositNow + gainValue,
    gainReturn: (gainValue * WAD) / amount,
    lossReturn: ((amount - depositNow) * WAD) / amount,
    liquidated:
      now.P !== past.P || now.epoch !== past.epoch || now.scale !== past.scale || firstPortion !== 0n || secondPortion !== 0n,
  };
}

function compounded(amount: bigint, past: SpPast, now: SpNow): bigint {
  if (now.epoch > past.epoch) return 0n; // the pool was emptied since the snapshot
  const scaleDiff = now.scale - past.scale;
  let value: bigint;
  if (scaleDiff === 0n) value = (amount * now.P) / past.P;
  else if (scaleDiff === 1n) value = (amount * now.P) / past.P / SCALE_FACTOR;
  else return 0n;
  return value < amount / SCALE_FACTOR ? 0n : value;
}
