import { MIN_USABLE_MUSD } from "@/lib/dashboard/readiness";

export type BalanceAction = { kind: "borrow-instead"; amount: bigint } | { kind: "use-balance"; amount: bigint; capped?: true } | { kind: "get-musd"; href: string };

/**
 * The ways out of "Amount exceeds your available MUSD" (U3 §5.4), at most two: borrow the amount
 * against the Trove (LP route, EOAs only, outside recovery mode; F4's checks), then the wallet's own
 * balance, capped by the executor's entry cap (`cap`, LP route) so the offered amount is not blocked
 * next. Without either, the Mezo app, where MUSD can be borrowed or swapped for.
 */
export function balanceRecoveries(input: {
  route: "lp" | "sp";
  amount: bigint;
  walletMusd: bigint;
  canBorrowAndDeploy: boolean;
  borrowLimit: bigint;
  recoveryMode: boolean;
  mezoAppUrl: string;
  /** The executor's per-transaction cap; the Stability Pool has none. */
  cap?: bigint;
}): BalanceAction[] {
  const actions: BalanceAction[] = [];
  if (input.route === "lp" && input.canBorrowAndDeploy && !input.recoveryMode && input.borrowLimit >= MIN_USABLE_MUSD) {
    actions.push({ kind: "borrow-instead", amount: input.amount < input.borrowLimit ? input.amount : input.borrowLimit });
  }
  if (input.walletMusd > 0n) {
    const capped = input.cap !== undefined && input.cap < input.walletMusd;
    actions.push(capped ? { kind: "use-balance", amount: input.cap as bigint, capped: true } : { kind: "use-balance", amount: input.walletMusd });
  }
  if (actions.length === 0) actions.push({ kind: "get-musd", href: input.mezoAppUrl });
  return actions;
}
