import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import type { TroveSnapshot } from "./snapshot";
import type { TroveState } from "./trove-math";

/** The exposure panel's input for the Trove alone (LP and Stability Pool left out): before and after the action. */
export function asDashboardSnapshot(s: TroveSnapshot, t: TroveState): DashboardSnapshot {
  return {
    price: s.market.price,
    protocol: { mcr: s.market.mcr, borrowingRate: s.market.borrowingRate },
    trove: { collateral: t.coll, principal: t.principal, interest: t.interest, debt: t.debt, maxBorrowingCapacity: t.maxBorrowingCapacity },
    musd: s.walletMusd,
    lp: { balance: 0n, totalSupply: 0n, reserveMusd: s.pool.reserveMusd, reserveBtc: s.pool.reserveBtc },
    sp: { deposit: 0n, btcGain: 0n },
    poolFeeBps: s.pool.feeBps,
    gauge: null,
    gaugeReadFailed: false,
    block: null,
    troveDebt: null,
    protocolOwnedSp: null,
  } as DashboardSnapshot;
}
