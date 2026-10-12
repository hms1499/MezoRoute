import { walletCapabilities, type WalletKind } from "@/lib/wallet/capabilities";
import { needsApproval } from "./params";

export type StepKind = "permit" | "approve" | "enter";

/**
 * EOA: a MUSD permit, then `enter`. Smart account or unknown kind: an exact approval transaction,
 * then `enter` (FR-06, FR-23). Nothing to authorise when the allowance already covers the amount.
 */
export function entrySteps(kind: WalletKind, allowance: bigint, musdIn: bigint): StepKind[] {
  if (!needsApproval(allowance, musdIn)) return ["enter"];
  return walletCapabilities(kind).permit ? ["permit", "enter"] : ["approve", "enter"];
}
