import { walletCapabilities, type WalletKind } from "@/lib/wallet/capabilities";

/**
 * Whether the Borrow & Deploy tab can be picked, and the reason shown under it when it cannot (FR-23, U7).
 * `hasTrove` is undefined until the Trove is read; the page's gate still blocks a send without one.
 */
export function borrowMode(walletKind: WalletKind | undefined, hasTrove: boolean | undefined): { disabled: boolean; note: string | null } {
  if (walletKind === "smart-account") return { disabled: true, note: "Borrow & Deploy needs a standard wallet signature." };
  if (walletKind === undefined || !walletCapabilities(walletKind).borrowAndDeploy) return { disabled: true, note: null };
  if (hasTrove === false) return { disabled: true, note: "Borrow & Deploy needs an open Trove. Open one in the Mezo app." };
  return { disabled: false, note: null };
}
