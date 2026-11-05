import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { exposure, lpValueAfterDrop, type Drawdown } from "@/lib/exposure/exposure";
import { emissionsApr, gaugeWeekOpen, mezoPerWeek } from "@/lib/gauge/maths";
import { entryValue, quoteEntry } from "@/lib/quote/entry";
import { afterEntry } from "@/lib/routes/musd-btc-lp/after-entry";
import { afterSpDeposit } from "@/lib/stability-pool/after-deposit";

/** The comparison's stress row: the new position after this BTC drop. */
export const STRESS_DROP: Drawdown = 30;

/**
 * The LP's staked alternative: MEZO from the gauge instead of swap fees. `open` is false between weeks,
 * when there is no rate to show; `apr` is null without a MEZO price (testnet has no price pool).
 */
export type LpGauge = { open: boolean; mezoPerWeek: bigint; apr: bigint | null };

export type LpComparison =
  | {
      status: "ok";
      fee: bigint; // MezoRoute's execution fee, MUSD
      priceImpact: bigint; // 1e18 = 100%
      positionValue: bigint; // the new LP share at the pool's price before the entry, MUSD
      btcBefore: bigint;
      btcAfter: bigint;
      valueAfterDrop: bigint;
      gauge: LpGauge | null; // null when the network has no gauge or the voter no longer counts it alive
    }
  | { status: "unavailable" }; // empty pool: quoteEntry has nothing to quote

export type SpComparison = { positionValue: bigint; btcBefore: bigint; btcAfter: bigint; valueAfterDrop: bigint };

export type ComparedRoutes = { amount: bigint; overBalance: boolean; lp: LpComparison; sp: SpComparison };

/**
 * Both routes for one amount, from the dashboard snapshot (Flow B, FR-19). Without an executor
 * (mainnet before M1) the LP side quotes with no fee; the card says the fee is set at launch.
 */
export function compareRoutes(input: {
  snapshot: DashboardSnapshot;
  amount: bigint;
  executorFeeBps: bigint | null;
  /** MUSD per MEZO, 1e18; null or absent when there is no price. */
  mezoPrice?: bigint | null;
}): ComparedRoutes {
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
      gauge: lpGauge(snapshot, quote.liquidity, input.mezoPrice ?? null),
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

/** What staking this deposit would earn, diluted by the amount entered. The week's own clock is the snapshot's block. */
function lpGauge(snapshot: DashboardSnapshot, liquidity: bigint, mezoPrice: bigint | null): LpGauge | null {
  const { gauge, block } = snapshot;
  if (!gauge || !gauge.alive || !block) return null;
  if (!gaugeWeekOpen(gauge, block.timestamp)) return { open: false, mezoPerWeek: 0n, apr: null };
  return {
    open: true,
    mezoPerWeek: mezoPerWeek(gauge.rewardRate, liquidity, gauge.totalStaked),
    apr: emissionsApr({
      rewardRate: gauge.rewardRate,
      mezoPrice,
      userLp: liquidity,
      totalStaked: gauge.totalStaked,
      // Reserves stand in for balances, as on the LP route page.
      pool: {
        reserveMusd: snapshot.lp.reserveMusd,
        reserveBtc: snapshot.lp.reserveBtc,
        balanceMusd: snapshot.lp.reserveMusd,
        balanceBtc: snapshot.lp.reserveBtc,
        totalSupply: snapshot.lp.totalSupply,
      },
    }),
  };
}
