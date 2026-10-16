import { MIN_USABLE_MUSD } from "@/lib/dashboard/readiness";

export type BalanceAction = { kind: "borrow-instead"; amount: bigint } | { kind: "use-balance"; amount: bigint } | { kind: "get-musd"; href: string };

/**
 * The ways out of "Amount exceeds your available MUSD" (U3 §5.4), at most two: borrow the amount
 * against the Trove (LP route, EOAs only, outside recovery mode; F4's checks), then the wallet's own
 * balance. Without either, the Mezo app, where MUSD can be borrowed or swapped for.
 */
export function balanceRecoveries(input: {
  route: "lp" | "sp";
  amount: bigint;
  walletMusd: bigint;
  canBorrowAndDeploy: boolean;
  borrowLimit: bigint;
  recoveryMode: boolean;
  mezoAppUrl: string;
}): BalanceAction[] {
  const actions: BalanceAction[] = [];
  if (input.route === "lp" && input.canBorrowAndDeploy && !input.recoveryMode && input.borrowLimit >= MIN_USABLE_MUSD) {
    actions.push({ kind: "borrow-instead", amount: input.amount < input.borrowLimit ? input.amount : input.borrowLimit });
  }
  if (input.walletMusd > 0n) actions.push({ kind: "use-balance", amount: input.walletMusd });
  if (actions.length === 0) actions.push({ kind: "get-musd", href: input.mezoAppUrl });
  return actions;
}
