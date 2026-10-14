import { needsApproval } from "@/lib/routes/musd-btc-lp/params";

export type SpStepKind = "approve" | "deposit";

/** The pool has no permit, so every wallet kind approves the exact amount unless the allowance covers it. */
export function spDepositSteps(allowance: bigint, musdIn: bigint): SpStepKind[] {
  return needsApproval(allowance, musdIn) ? ["approve", "deposit"] : ["deposit"];
}
