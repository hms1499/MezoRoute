import type { SpAction } from "./history";

/**
 * MUSD cost of the current Stability Pool deposit (spec §12): deposits add their amount; a withdrawal
 * removes cost pro rata to the share of the compounded deposit it takes (`basis × amount / before`),
 * the rule LP exits use. A plain "deposits − withdrawals" sum goes wrong once the deposit has absorbed
 * liquidated debt. `lastDeposit` must equal `deposits(account)`, or the explorer is behind the chain.
 */
export type SpCostBasis = { basis: bigint; gainsClaimed: bigint; lossRealised: bigint; lastDeposit: bigint };

export function spCostBasis(actions: SpAction[]): SpCostBasis {
  let basis = 0n;
  let gainsClaimed = 0n;
  let lossRealised = 0n;
  let lastDeposit = 0n;
  for (const action of actions) {
    gainsClaimed += action.gain;
    lossRealised += action.loss;
    if (action.kind === "deposit") basis += action.amount;
    else if (action.kind === "withdraw") basis -= action.before === 0n ? basis : (basis * action.amount) / action.before;
    lastDeposit = action.depositAfter;
  }
  return { basis, gainsClaimed, lossRealised, lastDeposit };
}

export function historyLagging(basis: SpCostBasis, initialDeposit: bigint): boolean {
  return basis.lastDeposit !== initialDeposit;
}

/** The explorer has not indexed the latest action yet; the history query retries on it. */
export class HistoryLagError extends Error {
  override name = "HistoryLagError";
}

export type HistoryStatus = "loading" | "updating" | "ready" | "unavailable";

/** The cost-basis rows' state from the history query: lag retries show "Updating…", not an error. */
export function historyStatus(input: { hasData: boolean; error: unknown; failureReason: unknown }): HistoryStatus {
  if (input.hasData) return "ready";
  if (input.error) return "unavailable";
  if (input.failureReason instanceof HistoryLagError) return "updating";
  return "loading";
}
