import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { exposure, lpValueAfterDrop, type Drawdown } from "@/lib/exposure/exposure";
import { entryValue, quoteEntry } from "@/lib/quote/entry";
import { afterEntry } from "@/lib/routes/musd-btc-lp/after-entry";
import { afterSpDeposit } from "@/lib/stability-pool/after-deposit";

/** The comparison's stress row: the new position after this BTC drop. */
export const STRESS_DROP: Drawdown = 30;

export type LpComparison =
  | {
      status: "ok";
      fee: bigint; // MezoRoute's execution fee, MUSD
      priceImpact: bigint; // 1e18 = 100%
      positionValue: bigint; // the new LP share at the pool's price before the entry, MUSD
      btcBefore: bigint;
      btcAfter: bigint;
      valueAfterDrop: bigint;
    }
  | { status: "unavailable" }; // empty pool: quoteEntry has nothing to quote

export type SpComparison = { positionValue: bigint; btcBefore: bigint; btcAfter: bigint; valueAfterDrop: bigint };

export type ComparedRoutes = { amount: bigint; overBalance: boolean; lp: LpComparison; sp: SpComparison };

/**
 * Both routes for one amount, from the dashboard snapshot (Flow B, FR-19). Without an executor
 * (mainnet before M1) the LP side quotes with no fee; the card says the fee is set at launch.
 */
export function compareRoutes(input: { snapshot: DashboardSnapshot; amount: bigint; executorFeeBps: bigint | null }): ComparedRoutes {
  const { snapshot, amount } = input;
  const btcBefore = exposure(snapshot).totalBtc;
  const pool = {
    reserveMusd: snapshot.lp.reserveMusd,
    reserveBtc: snapshot.lp.reserveBtc,
    totalSupply: snapshot.lp.totalSupply,
    feeBps: snapshot.poolFeeBps,
  };
  const quote = quoteEntry(pool, amount, input.executorFeeBps ?? 0n);
  let lp: LpComparison = { status: "unavailable" };
  if (quote) {
    const positionValue = entryValue(pool, quote);
    lp = {
      status: "ok",
      fee: quote.fee,
      priceImpact: quote.priceImpact,
      positionValue,
      btcBefore,
      btcAfter: exposure(afterEntry(snapshot, quote)).totalBtc,
      valueAfterDrop: lpValueAfterDrop(positionValue, STRESS_DROP),
    };
  }
  return {
    amount,
    overBalance: amount > snapshot.musd,
    lp,
    sp: {
      positionValue: amount,
      btcBefore,
      btcAfter: exposure(afterSpDeposit(snapshot, amount)).totalBtc,
      valueAfterDrop: amount, // MUSD does not move with BTC; new liquidations are not modelled
    },
  };
}
