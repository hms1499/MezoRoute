import { WAD } from "@/lib/math";
import { quoteEntry, type PoolState } from "@/lib/quote/entry";
import { annualise } from "./window";

/**
 * The pool at one block: the quote's state plus the fee indexes, mapped by token. An index is the
 * token amount one LP token (1e18) has earned since the pool began (Pool._update0/_update1).
 */
export type PoolPoint = PoolState & { indexMusd: bigint; indexBtc: bigint };

export type LpBacktest = {
  liquidity: bigint; // LP the amount would have received at the past block
  feesMusd: bigint;
  feesBtc: bigint;
  feesValue: bigint; // MUSD, BTC at today's pool price
  valueNow: bigint; // MUSD: today's pool share + entry refunds + fees, BTC at today's pool price
  feeReturn: bigint; // feesValue / amount, 1e18 = 100%
  feeRate: bigint; // feeReturn as a simple yearly rate
};

/**
 * What `amount` MUSD entered at `past` would be worth at `now` (spec F6 §1). An unstaked LP token
 * earns exactly the index growth, so the fees need no event scan. BTC is valued at today's pool mid
 * price, not the oracle: an exit sells it into this pool, and on testnet the two differ by ≈3%.
 * Null for an empty pool.
 */
export function lpBacktest(input: {
  past: PoolPoint;
  now: PoolPoint;
  amount: bigint;
  executorFeeBps: bigint;
  seconds: bigint;
}): LpBacktest | null {
  const { past, now, amount } = input;
  const quote = quoteEntry(past, amount, input.executorFeeBps);
  if (quote === null || now.totalSupply === 0n || now.reserveBtc === 0n) return null;
  const price = (now.reserveMusd * WAD) / now.reserveBtc;
  const { liquidity } = quote;
  const feesMusd = (liquidity * (now.indexMusd - past.indexMusd)) / WAD;
  const feesBtc = (liquidity * (now.indexBtc - past.indexBtc)) / WAD;
  const feesValue = feesMusd + (feesBtc * price) / WAD;
  const musdNow = (liquidity * now.reserveMusd) / now.totalSupply;
  const btcNow = (liquidity * now.reserveBtc) / now.totalSupply;
  const valueNow = musdNow + quote.musdRefund + feesMusd + ((btcNow + feesBtc + quote.btcRefund) * price) / WAD;
  const feeReturn = (feesValue * WAD) / amount;
  return { liquidity, feesMusd, feesBtc, feesValue, valueNow, feeReturn, feeRate: annualise(feeReturn, input.seconds) };
}
