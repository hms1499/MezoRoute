import { STRESS_DROP } from "@/lib/compare/comparison";
import { backtestRoutes, type RouteBacktests, type RouteHistory } from "@/lib/compare/history";
import { lpValueAfterDrop } from "@/lib/exposure/exposure";
import { WAD } from "@/lib/math";
import { quoteEntry } from "@/lib/quote/entry";
import type { MainnetReference } from "@/lib/reference/snapshot";

/** Mainnet's per-transaction entry cap (`contracts/script/Deploy.s.sol` `maxMusdInFor`: 1,000 MUSD). */
export const MAINNET_MAX_MUSD_IN = 1_000n * WAD;

export type LandingLp =
  | { status: "ok"; positionValue: bigint; btcAdded: bigint; valueAfterDrop: bigint; fee: bigint }
  | { status: "unavailable" };

export type LandingSimulation = {
  amount: bigint;
  executorFeeBps: bigint;
  overCap: boolean;
  lp: LandingLp;
  sp: { positionValue: bigint; btcAdded: bigint; valueAfterDrop: bigint };
  backtests: RouteBacktests | null;
};

/**
 * Both routes for `amount` MUSD from Mezo mainnet data, with no wallet (U2 landing simulator). The LP
 * side follows `compareRoutes` exactly (pool price before the trade); the 30-day rows are F6's backtest.
 */
export function simulateRoutes(input: {
  reference: MainnetReference;
  history: RouteHistory | null;
  amount: bigint;
  executorFeeBps: bigint;
}): LandingSimulation {
  const { reference: r, amount, executorFeeBps } = input;
  const pool = { reserveMusd: r.reserveMusd, reserveBtc: r.reserveBtc, totalSupply: r.lpSupply, feeBps: r.feeBps };
  const quote = quoteEntry(pool, amount, executorFeeBps);
  let lp: LandingLp = { status: "unavailable" };
  if (quote) {
    const shareMusd = (quote.liquidity * quote.after.reserveMusd) / quote.after.totalSupply;
    const shareBtc = (quote.liquidity * quote.after.reserveBtc) / quote.after.totalSupply;
    const positionValue = shareMusd + (shareBtc * pool.reserveMusd) / pool.reserveBtc;
    lp = { status: "ok", positionValue, btcAdded: shareBtc, valueAfterDrop: lpValueAfterDrop(positionValue, STRESS_DROP), fee: quote.fee };
  }
  return {
    amount,
    executorFeeBps,
    overCap: amount > MAINNET_MAX_MUSD_IN,
    lp,
    sp: { positionValue: amount, btcAdded: 0n, valueAfterDrop: amount },
    backtests: input.history ? backtestRoutes(input.history, amount, executorFeeBps) : null,
  };
}
