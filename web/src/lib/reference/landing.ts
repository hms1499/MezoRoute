import { lpHistoryLine } from "@/lib/compare/view";
import { formatPercent, formatToken } from "@/lib/format";
import type { MainnetReferenceData } from "./load";
import { referenceView } from "./snapshot";

export type LandingLive =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "data"; poolValue: string; lpFees: string | null; spDeposits: string; spShare: string };

/** The landing page's live mainnet figures: a skeleton while loading, nothing on error (the page stays complete). */
export function landingLive(data: MainnetReferenceData | undefined, error: Error | null): LandingLive {
  if (data) {
    const view = referenceView(data.reference);
    return {
      kind: "data",
      poolValue: `${formatToken(view.poolTvl, 18, 0)} MUSD`,
      lpFees: data.backtests?.lp ? lpHistoryLine(data.backtests.lp) : null,
      spDeposits: `${formatToken(data.reference.spDeposits, 18, 0)} MUSD`,
      spShare: formatPercent(view.spShare, 1),
    };
  }
  return error ? { kind: "hidden" } : { kind: "loading" };
}
