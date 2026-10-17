import { walletCapabilities, type WalletKind } from "@/lib/wallet/capabilities";
import type { EntryMode } from "./intent";
import { needsApproval } from "./params";

export type StepKind = "permit" | "approve" | "borrow" | "enter";

/**
 * EOA: a MUSD permit; smart account or unknown kind: an exact approval (FR-06, FR-23); nothing when
 * the allowance already covers the amount. Borrow mode adds the borrow authorisation before sending.
 */
export function entrySteps(kind: WalletKind, allowance: bigint, musdIn: bigint, mode: EntryMode = "deposit"): StepKind[] {
  const authorise: StepKind[] = !needsApproval(allowance, musdIn)
    ? []
    : walletCapabilities(kind).permit
      ? ["permit"]
      : ["approve"];
  return mode === "borrow" ? [...authorise, "borrow", "enter"] : [...authorise, "enter"];
}
