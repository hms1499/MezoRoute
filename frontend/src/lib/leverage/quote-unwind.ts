import { GAS_COMPENSATION, MIN_NET_DEBT } from "@/lib/trove/constants";
import { oracleCostBps } from "./oracle-cost";
import { exactInput } from "./pool-math";
import { cr, troveAfter, type Market, type PoolState, type TroveState } from "./trove-math";

const BPS = 10_000n;

export type UnwindQuote = {
  debtToRepay: bigint;
  collWithdrawal: bigint; // signed; also the most BTC the wallet pays the pool
  maxBtcToPool: bigint;
  btcToPool: bigint; // at the quoted reserves
  btcToWallet: bigint; // collWithdrawal - btcToPool
  costBps: bigint;
  before: TroveState;
  after: TroveState;
  crBefore: bigint;
  crAfter: bigint;
};

/** The largest repayment that keeps net debt at 1,800 MUSD (beyond it, Close). */
export function unwindMax(t: TroveState): bigint {
  const max = t.debt - MIN_NET_DEBT - GAS_COMPENSATION;
  return max > 0n ? max : 0n;
}

function quoteAt(t: TroveState, pool: PoolState, market: Market, repay: bigint, slippageBps: bigint): UnwindQuote {
  const btcToPool = exactInput(pool.reserveBtc, pool.reserveMusd, repay, pool.feeBps);
  const withdrawal = (btcToPool * (BPS + slippageBps) + BPS - 1n) / BPS;
  const after = troveAfter(t, { collDelta: -withdrawal, debtDelta: -repay, feeOnIncrease: 0n });
  return {
    debtToRepay: repay,
    collWithdrawal: withdrawal,
    maxBtcToPool: withdrawal,
    btcToPool,
    btcToWallet: withdrawal - btcToPool,
    costBps: oracleCostBps("sellBtc", repay, btcToPool, market.price),
    before: t,
    after,
    crBefore: cr(t, market.price) ?? 0n,
    crAfter: cr(after, market.price) ?? 0n,
  };
}

/**
 * The smallest repayment (selling collateral for it) that lifts CR to `targetCr`; the withdrawal is
 * the pool's BTC plus slippage, so the CR after counts the whole withdrawal. Null when the target is
 * not above today's CR or needs more than `unwindMax`.
 */
export function quoteUnwind(t: TroveState, pool: PoolState, market: Market, targetCr: bigint, slippageBps: bigint): UnwindQuote | null {
  const current = cr(t, market.price);
  const max = unwindMax(t);
  if (current === null || targetCr <= current || max === 0n) return null;
  if (quoteAt(t, pool, market, max, slippageBps).crAfter < targetCr) return null;
  let lo = 1n;
  let hi = max;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if (quoteAt(t, pool, market, mid, slippageBps).crAfter >= targetCr) hi = mid;
    else lo = mid + 1n;
  }
  return quoteAt(t, pool, market, lo, slippageBps);
}

/** The highest CR an Unwind can reach (at `unwindMax`); the page offers Close above it. */
export function unwindMaxCr(t: TroveState, pool: PoolState, market: Market, slippageBps: bigint): bigint | null {
  const max = unwindMax(t);
  return max === 0n ? null : quoteAt(t, pool, market, max, slippageBps).crAfter;
}
