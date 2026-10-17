import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { isqrt, WAD } from "@/lib/math";
import { collateralRatio } from "@/lib/trove/health";

/** BTC price drops shown on the dashboard and previews (PRODUCT_SPEC §12, FR-15). */
export const DRAWDOWNS = [10, 20, 30] as const;
export type Drawdown = (typeof DRAWDOWNS)[number];

export type Exposure = {
  troveBtc: bigint;
  lpBtc: bigint; // the wallet's LP share of the pool's BTC
  lpMusd: bigint; // the wallet's LP share of the pool's MUSD
  spBtcGain: bigint;
  spDeposit: bigint;
  totalBtc: bigint; // troveBtc + lpBtc + spBtcGain
  lpValue: bigint; // MUSD: lpMusd + lpBtc × price
  spValue: bigint; // MUSD: spDeposit + spBtcGain × price
};

export type Scenario = {
  dropPercent: Drawdown;
  price: bigint;
  collateralRatio: bigint | null; // null without a Trove or without debt
  liquidatable: boolean; // collateralRatio below the protocol MCR
  lpValue: bigint; // constant-product approximation, fees ignored
  spValue: bigint; // new liquidations caused by the drop are not modelled
};

/** BTC held across the Trove, the LP share, and Stability Pool gains, valued at the oracle price. Rounds down. */
export function exposure(snapshot: DashboardSnapshot): Exposure {
  const { price, trove, lp, sp } = snapshot;
  const share = (reserve: bigint) => (lp.totalSupply === 0n ? 0n : (lp.balance * reserve) / lp.totalSupply);
  const troveBtc = trove?.collateral ?? 0n;
  const lpBtc = share(lp.reserveBtc);
  const lpMusd = share(lp.reserveMusd);
  return {
    troveBtc,
    lpBtc,
    lpMusd,
    spBtcGain: sp.btcGain,
    spDeposit: sp.deposit,
    totalBtc: troveBtc + lpBtc + sp.btcGain,
    lpValue: lpMusd + (lpBtc * price) / WAD,
    spValue: sp.deposit + (sp.btcGain * price) / WAD,
  };
}

/** A constant-product LP's value after a BTC drop: it scales with √(price ratio). Rounds down. */
export function lpValueAfterDrop(value: bigint, dropPercent: Drawdown): bigint {
  const lpFactor = isqrt((BigInt(100 - dropPercent) * WAD * WAD) / 100n);
  return (value * lpFactor) / WAD;
}

/** The dashboard's "what if BTC drops" table: one row per drawdown, all values rounded down. */
export function drawdownScenarios(snapshot: DashboardSnapshot, current: Exposure): Scenario[] {
  return DRAWDOWNS.map((dropPercent) => {
    const keep = BigInt(100 - dropPercent);
    const price = (snapshot.price * keep) / 100n;
    const cr = snapshot.trove ? collateralRatio(snapshot.trove, price) : null;
    return {
      dropPercent,
      price,
      collateralRatio: cr,
      liquidatable: cr !== null && cr < snapshot.protocol.mcr,
      lpValue: lpValueAfterDrop(current.lpValue, dropPercent),
      spValue: current.spDeposit + (current.spBtcGain * price) / WAD,
    };
  });
}

/** The double-exposure warning applies only when BTC backs a Trove and also sits in the LP (U1 copy rule). */
export function showsDoubleExposure(current: Exposure): boolean {
  return current.troveBtc > 0n && (current.lpBtc > 0n || current.lpMusd > 0n);
}
