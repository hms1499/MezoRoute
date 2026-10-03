export type WalletKind = "eoa" | "smart-account";

export type WalletCapabilities = { permit: boolean; borrowAndDeploy: boolean };

/**
 * Bitcoin wallets connect through OrangeKit and act through a Safe that is deployed lazily on the
 * first transaction, so `getCode` alone misses them until then. The connector decides first;
 * deployed code catches other contract wallets (for example a Safe connected via WalletConnect).
 */
export function walletKind(input: { connectorType: string; connectorId: string; hasCode: boolean }): WalletKind {
  if (input.connectorType === "orangekit" || input.connectorId.startsWith("orangekit-")) return "smart-account";
  return input.hasCode ? "smart-account" : "eoa";
}

/** Smart accounts cannot produce ecrecover signatures: no permits and no Borrow & Deploy (spec FR-23). */
export function walletCapabilities(kind: WalletKind): WalletCapabilities {
  return kind === "eoa" ? { permit: true, borrowAndDeploy: true } : { permit: false, borrowAndDeploy: false };
}
