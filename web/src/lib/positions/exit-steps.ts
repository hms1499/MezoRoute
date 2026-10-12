import { needsApproval } from "@/lib/routes/musd-btc-lp/params";
import { walletCapabilities, type WalletKind } from "@/lib/wallet/capabilities";

export type ExitStepKind = "permit" | "approve" | "exit";

/** EOA: an LP permit; smart account or unknown: an exact LP approval; nothing when the allowance covers it. */
export function exitSteps(kind: WalletKind, allowance: bigint, liquidityIn: bigint): ExitStepKind[] {
  if (!needsApproval(allowance, liquidityIn)) return ["exit"];
  return walletCapabilities(kind).permit ? ["permit", "exit"] : ["approve", "exit"];
}
