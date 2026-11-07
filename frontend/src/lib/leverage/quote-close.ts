import { CLOSE_INTEREST_MARGIN_SECONDS, GAS_COMPENSATION } from "@/lib/trove/constants";
import { oracleCostBps } from "./oracle-cost";
import { exactInput } from "./pool-math";
import type { Market, PoolState, TroveState } from "./trove-math";

const BPS = 10_000n;
const SECONDS_PER_YEAR = 31_536_000n;

export type CloseQuote = {
  musdNeeded: bigint; // debt - 200 MUSD gas compensation, flashed and burned
  btcToPool: bigint;
  maxBtcToPool: bigint; // covers CLOSE_INTEREST_MARGIN_SECONDS of interest plus slippage
  btcToWallet: bigint; // coll - btcToPool
  collReturned: bigint;
  costBps: bigint;
};

/** Interest the Trove accrues in `seconds` (MUSD: principal × rate bps × time / (1e4 × year)), rounded up. */
export function interestOver(t: TroveState, seconds: bigint): bigint {
  const n = t.principal * t.interestRateBps * seconds;
  const d = BPS * SECONDS_PER_YEAR;
  return (n + d - 1n) / d;
}

export function quoteClose(t: TroveState, pool: PoolState, market: Market, slippageBps: bigint): CloseQuote {
  const musdNeeded = t.debt - GAS_COMPENSATION;
  const btcToPool = exactInput(pool.reserveBtc, pool.reserveMusd, musdNeeded, pool.feeBps);
  const later = exactInput(pool.reserveBtc, pool.reserveMusd, musdNeeded + interestOver(t, CLOSE_INTEREST_MARGIN_SECONDS), pool.feeBps);
  return {
    musdNeeded,
    btcToPool,
    maxBtcToPool: (later * (BPS + slippageBps) + BPS - 1n) / BPS,
    btcToWallet: t.coll - btcToPool,
    collReturned: t.coll,
    costBps: oracleCostBps("sellBtc", musdNeeded, btcToPool, market.price),
  };
}
