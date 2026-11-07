import { LEVERAGE_CR_FLOOR } from "@/lib/trove/constants";
import { capacityCheck, type CapacityCheck } from "./capacity";
import { oracleCostBps, withinOracleBound } from "./oracle-cost";
import { exactInput } from "./pool-math";
import { borrowingFee, cr, troveAfter, type Market, type PoolState, type TroveState } from "./trove-math";

const BPS = 10_000n;

export type LeverageQuote = {
  btcToAdd: bigint;
  maxMusdToPool: bigint; // the pool's MUSD plus slippage
  musdToPool: bigint; // at the quoted reserves
  fee: bigint; // MezoRoute fee on musdToPool
  debtIncrease: bigint; // signed: maxMusdToPool + its fee, all of it minted to the wallet
  borrowingFee: bigint; // added to the Trove's debt by the protocol
  musdSurplus: bigint; // stays in the wallet at the quoted reserves
  costBps: bigint;
  before: TroveState;
  after: TroveState;
  crBefore: bigint;
  crAfter: bigint;
  capacity: CapacityCheck;
};

/** The quote for adding exactly `btcToAdd`. */
export function leverageQuoteAt(
  t: TroveState,
  pool: PoolState,
  market: Market,
  btcToAdd: bigint,
  slippageBps: bigint,
  feeBps: bigint,
): LeverageQuote {
  const musdToPool = exactInput(pool.reserveMusd, pool.reserveBtc, btcToAdd, pool.feeBps);
  const maxMusdToPool = (musdToPool * (BPS + slippageBps) + BPS - 1n) / BPS;
  const debtIncrease = maxMusdToPool + (maxMusdToPool * feeBps) / BPS;
  const fee = (musdToPool * feeBps) / BPS;
  const borrowFee = borrowingFee(debtIncrease, market.borrowingRate);
  const after = troveAfter(t, { collDelta: btcToAdd, debtDelta: debtIncrease, feeOnIncrease: borrowFee });
  return {
    btcToAdd,
    maxMusdToPool,
    musdToPool,
    fee,
    debtIncrease,
    borrowingFee: borrowFee,
    musdSurplus: debtIncrease - musdToPool - fee,
    costBps: oracleCostBps("buyBtc", musdToPool, btcToAdd, market.price),
    before: t,
    after,
    crBefore: cr(t, market.price) ?? 0n,
    crAfter: cr(after, market.price) ?? 0n,
    capacity: capacityCheck(t, market.price, debtIncrease, market.borrowingRate),
  };
}

/** Largest `y` in [lo, hi] with `ok(y)`, for a predicate true up to some point and false after. */
export function largestWhere(lo: bigint, hi: bigint, ok: (y: bigint) => boolean): bigint {
  if (hi < lo || !ok(lo)) return 0n;
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    if (ok(mid)) lo = mid;
    else hi = mid - 1n;
  }
  return lo;
}

const MIN_BTC = 10n ** 9n;

/** The most BTC whose Trove still ends at or above `targetCr`; null when the target is not below today's CR. */
export function quoteLeverage(
  t: TroveState,
  pool: PoolState,
  market: Market,
  targetCr: bigint,
  slippageBps: bigint,
  feeBps: bigint,
): LeverageQuote | null {
  const current = cr(t, market.price);
  if (current === null || targetCr >= current) return null;
  const y = largestWhere(MIN_BTC, pool.reserveBtc / 2n, (b) => leverageQuoteAt(t, pool, market, b, slippageBps, feeBps).crAfter >= targetCr);
  return y === 0n ? null : leverageQuoteAt(t, pool, market, y, slippageBps, feeBps);
}

export type LeverageLimit = "floor" | "cap" | "capacity" | "oracle";

/** The largest Leverage the page offers and what stops it there. */
export function leverageMax(
  t: TroveState,
  pool: PoolState,
  market: Market,
  feeBps: bigint,
  caps: { maxBtcFlash: bigint },
  boundBps: bigint,
  slippageBps: bigint,
): { btc: bigint; limitedBy: LeverageLimit } {
  const hi = pool.reserveBtc / 2n;
  const at = (b: bigint) => leverageQuoteAt(t, pool, market, b, slippageBps, feeBps);
  const limits: [LeverageLimit, bigint][] = [
    ["floor", largestWhere(MIN_BTC, hi, (b) => at(b).crAfter >= LEVERAGE_CR_FLOOR)],
    ["cap", caps.maxBtcFlash],
    ["capacity", largestWhere(MIN_BTC, hi, (b) => at(b).capacity !== "blocked")],
    ["oracle", largestWhere(MIN_BTC, hi, (b) => withinOracleBound("buyBtc", at(b).musdToPool, b, market.price, boundBps))],
  ];
  return limits.reduce<{ btc: bigint; limitedBy: LeverageLimit }>(
    (best, [limitedBy, btc]) => (btc < best.btc ? { btc, limitedBy } : best),
    { btc: limits[0][1], limitedBy: limits[0][0] },
  );
}
