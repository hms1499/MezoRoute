import { needsApproval } from "@/lib/routes/musd-btc-lp/params";
import { walletCapabilities, type WalletKind } from "@/lib/wallet/capabilities";

export type ExitStepKind = "unstake" | "permit" | "approve" | "exit";

/**
 * Unstake first when the wallet lacks the LP (the permit is signed only after it confirms, because its
 * deadline runs while the user waits); then an LP permit (EOA) or an exact LP approval (smart account or
 * unknown), skipped when the allowance covers it; then the exit.
 */
export function exitSteps(kind: WalletKind, allowance: bigint, liquidityIn: bigint, unstake: bigint): ExitStepKind[] {
  const first: ExitStepKind[] = unstake > 0n ? ["unstake"] : [];
  if (!needsApproval(allowance, liquidityIn)) return [...first, "exit"];
  return [...first, walletCapabilities(kind).permit ? "permit" : "approve", "exit"];
}
