import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import type { EntryQuote } from "@/lib/quote/entry";

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
