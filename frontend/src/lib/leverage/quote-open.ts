import { WAD } from "@/lib/math";
import { GAS_COMPENSATION, MIN_NET_DEBT } from "@/lib/trove/constants";
import { oracleCostBps } from "./oracle-cost";
import { exactInput } from "./pool-math";
import { largestWhere } from "./quote-leverage";
import { borrowingFee, cr, type Market, type PoolState, type TroveState } from "./trove-math";

const BPS = 10_000n;

export type OpenQuote = {
  btcFromUser: bigint;
  btcToFlash: bigint;
  debtAmount: bigint; // signed; minted to the wallet
  maxMusdToPool: bigint;
  musdToPool: bigint;
  fee: bigint;
  musdSurplus: bigint;
  costBps: bigint;
  after: TroveState;
  crAfter: bigint;
};

/** The smallest debt whose net debt (debt + borrowing fee) is at least 1,800 MUSD. */
function minDebt(borrowingRate: bigint): bigint {
  let d = (MIN_NET_DEBT * WAD) / (WAD + borrowingRate);
  while (d + borrowingFee(d, borrowingRate) < MIN_NET_DEBT) d += 1n;
  return d;
}

function openAt(own: bigint, pool: PoolState, market: Market, flash: bigint, slippageBps: bigint, feeBps: bigint): OpenQuote {
  const musdToPool = exactInput(pool.reserveMusd, pool.reserveBtc, flash, pool.feeBps);
  const maxMusdToPool = (musdToPool * (BPS + slippageBps) + BPS - 1n) / BPS;
  const pull = maxMusdToPool + (maxMusdToPool * feeBps) / BPS;
  const floor = minDebt(market.borrowingRate);
  const debtAmount = pull > floor ? pull : floor;
  const fee = (musdToPool * feeBps) / BPS;
  const principal = debtAmount + borrowingFee(debtAmount, market.borrowingRate) + GAS_COMPENSATION;
  const coll = own + flash;
  const after: TroveState = {
    coll,
    principal,
    interest: 0n,
    debt: principal,
    maxBorrowingCapacity: (coll * market.price) / ((110n * WAD) / 100n),
    interestRateBps: 0n,
  };
  return {
    btcFromUser: own,
    btcToFlash: flash,
    debtAmount,
    maxMusdToPool,
    musdToPool,
    fee,
    musdSurplus: debtAmount - musdToPool - fee,
    costBps: oracleCostBps("buyBtc", musdToPool, flash, market.price),
    after,
    crAfter: cr(after, market.price) ?? 0n,
  };
}

/**
 * Open a Trove with `btcFromUser` plus the most flashed BTC (≤ `maxBtcFlash`) that keeps CR at or above
 * `targetCr`. While the pool's MUSD is under the 1,800 MUSD minimum the debt stays at the minimum and
 * more BTC only raises CR; past it CR falls, so CR peaks where the pool's MUSD meets the minimum.
 * Null when even that peak is below the target.
 */
export function quoteOpen(
  btcFromUser: bigint,
  pool: PoolState,
  market: Market,
  targetCr: bigint,
  slippageBps: bigint,
  feeBps: bigint,
  maxBtcFlash: bigint,
): OpenQuote | null {
  const hi = maxBtcFlash < pool.reserveBtc / 2n ? maxBtcFlash : pool.reserveBtc / 2n;
  const at = (y: bigint) => openAt(btcFromUser, pool, market, y, slippageBps, feeBps);
  const floor = minDebt(market.borrowingRate);
  // The peak: the largest flash whose pull still fits under the minimum debt (or hi).
  const peak = largestWhere(1n, hi, (y) => at(y).debtAmount === floor) || 1n;
  if (at(hi).crAfter >= targetCr) return at(hi);
  if (at(peak).crAfter < targetCr) return null;
  return at(largestWhere(peak, hi, (y) => at(y).crAfter >= targetCr));
}
