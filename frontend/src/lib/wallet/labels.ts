import type { WalletKind } from "./capabilities";

/** How the wallet card names the wallet kind; `bitcoinWallet` is true for OrangeKit connectors. */
export function walletKindLabel(kind: WalletKind | undefined, bitcoinWallet: boolean): string {
  if (kind === undefined) return "checking…";
  if (kind === "eoa") return "standard wallet";
  if (kind === "unknown") return "unknown wallet type";
  return bitcoinWallet ? "Bitcoin wallet (smart account)" : "smart account";
}

/** The note under the wallet card that explains how this kind of wallet approves. */
export function walletKindNote(kind: WalletKind | undefined, bitcoinWallet: boolean): string | null {
  if (kind === "smart-account") {
    return bitcoinWallet
      ? "Your Bitcoin wallet acts through a smart account: approvals are exact and sent as separate transactions."
      : "Your wallet is a smart account: approvals are exact and sent as separate transactions.";
  }
  if (kind === "unknown") return "Couldn't check your wallet type; using exact approvals.";
  return null;
}
