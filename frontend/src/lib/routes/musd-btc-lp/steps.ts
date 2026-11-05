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

/** What the deposit transaction does, in order. The same for MUSD and BTC entries; the borrow and the stake happen inside it. */
export function enterStepDetail({ mode, stake }: { mode: EntryMode; stake: boolean }): string {
  const parts = [...(mode === "borrow" ? ["borrow"] : []), "fee", "swap"];
  const work = stake ? `${parts.join(", ")}, add liquidity, and stake` : `${parts.join(", ")}, and add liquidity`;
  return `One transaction: ${work}. Leftovers return to you.`;
}
