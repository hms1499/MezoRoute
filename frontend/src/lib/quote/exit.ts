import { ceilDiv, WAD } from "@/lib/math";
import type { PoolState } from "./entry";

const BPS = 10_000n;

/** The pool as `exit` sees it: Pool.burn pays a share of the token balances, not of the reserves. */
export type ExitPool = PoolState & { balanceMusd: bigint; balanceBtc: bigint };

export type ExitQuote = {
  liquidityIn: bigint;
  musdRemoved: bigint;
  btcRemoved: bigint;
  musdFromSwap: bigint;
  musdOut: bigint; // musdRemoved + musdFromSwap
  priceImpact: bigint; // the BTC→MUSD swap against the pre-exit mid price; 1e18 = 100%, rounded up
};

export type ExitMinimums = { minMusdRemoved: bigint; minBtcRemoved: bigint; minMusdFromSwap: bigint; minMusdOut: bigint };

/**
 * The executor's exit with the contracts' rounding: Pool.burn pays `liquidity × balance / supply`
 * per token and sets the reserves to the new balances; the BTC is then sold on those reserves with
 * the fee taken out first (Pool.getAmountOut). Null where `burn` or the swap would revert.
 */
export function quoteExit(pool: ExitPool, liquidityIn: bigint): ExitQuote | null {
  if (liquidityIn <= 0n || pool.totalSupply === 0n || liquidityIn > pool.totalSupply) return null;
  const musdRemoved = (liquidityIn * pool.balanceMusd) / pool.totalSupply;
  const btcRemoved = (liquidityIn * pool.balanceBtc) / pool.totalSupply;
  if (musdRemoved === 0n || btcRemoved === 0n) return null; // InsufficientLiquidityBurned
  const reserveMusd = pool.balanceMusd - musdRemoved;
  const reserveBtc = pool.balanceBtc - btcRemoved;
  const swapIn = btcRemoved - (btcRemoved * pool.feeBps) / BPS;
  const musdFromSwap = (swapIn * reserveMusd) / (reserveBtc + swapIn);
  if (musdFromSwap === 0n) return null;
  return {
    liquidityIn,
    musdRemoved,
    btcRemoved,
    musdFromSwap,
    musdOut: musdRemoved + musdFromSwap,
    priceImpact: exitPriceImpact(pool, btcRemoved, musdFromSwap),
  };
}

/** 1 − musdFromSwap × R_btc / (btcIn × R_musd), against the reserves before the exit. */
function exitPriceImpact(pool: PoolState, btcIn: bigint, musdFromSwap: bigint): bigint {
  const atMid = btcIn * pool.reserveMusd;
  const received = musdFromSwap * pool.reserveBtc;
  return atMid > received ? ceilDiv((atMid - received) * WAD, atMid) : 0n;
}

/** Each expected value minus the slippage, rounded down (the four minimums of ExitParams). */
export function exitMinimums(quote: ExitQuote, slippageBps: bigint): ExitMinimums {
  const floor = (value: bigint) => (value * (BPS - slippageBps)) / BPS;
  return {
    minMusdRemoved: floor(quote.musdRemoved),
    minBtcRemoved: floor(quote.btcRemoved),
    minMusdFromSwap: floor(quote.musdFromSwap),
    minMusdOut: floor(quote.musdOut),
  };
}
