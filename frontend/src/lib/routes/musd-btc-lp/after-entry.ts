import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import type { EntryQuote } from "@/lib/quote/entry";
import type { BorrowEffect } from "@/lib/trove/borrow";

/** The dashboard snapshot as it would be after the quoted entry, for the "after" exposure panel. */
export function afterEntry(snapshot: DashboardSnapshot, quote: EntryQuote): DashboardSnapshot {
  return {
    ...snapshot,
    musd: snapshot.musd - quote.musdIn + quote.musdRefund,
    lp: {
      balance: snapshot.lp.balance + quote.liquidity,
      totalSupply: quote.after.totalSupply,
      reserveMusd: quote.after.reserveMusd,
      reserveBtc: quote.after.reserveBtc,
    },
  };
}

/**
 * After Borrow & Deploy: the Trove carries the new debt and principal, the borrowed MUSD went into
 * the pool (the wallet only gains the MUSD refund), and the LP is as after a plain entry.
 */
export function afterBorrowEntry(snapshot: DashboardSnapshot, quote: EntryQuote, effect: BorrowEffect): DashboardSnapshot {
  const entered = afterEntry(snapshot, quote);
  return {
    ...entered,
    musd: snapshot.musd + quote.musdRefund,
    trove: snapshot.trove && { ...snapshot.trove, principal: effect.newPrincipal, debt: effect.newDebt },
  };
}
