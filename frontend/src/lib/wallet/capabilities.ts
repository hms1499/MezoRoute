export type WalletKind = "eoa" | "smart-account" | "unknown";

export type WalletCapabilities = { permit: boolean; borrowAndDeploy: boolean };

/** OrangeKit (Bitcoin-wallet) connectors act through a Safe. */
export function isOrangeKitConnector(connector: { type: string; id: string }): boolean {
  return connector.type === "orangekit" || connector.id.startsWith("orangekit-");
}

/**
 * Bitcoin wallets connect through OrangeKit and act through a Safe that is deployed lazily on the
 * first transaction, so `getCode` alone misses them until then. The connector decides first;
 * deployed code catches other contract wallets (for example a Safe connected via WalletConnect).
 * `hasCode` is undefined when the getCode read failed, and the kind is then unknown.
 */
export function walletKind(input: {
  connectorType: string;
  connectorId: string;
  hasCode: boolean | undefined;
}): WalletKind {
  if (isOrangeKitConnector({ type: input.connectorType, id: input.connectorId })) return "smart-account";
  if (input.hasCode === undefined) return "unknown";
  return input.hasCode ? "smart-account" : "eoa";
}

/**
 * Smart accounts cannot produce ecrecover signatures: no permits and no Borrow & Deploy (spec FR-23).
 * An unknown kind gets the same safe defaults.
 */
export function walletCapabilities(kind: WalletKind): WalletCapabilities {
  return kind === "eoa" ? { permit: true, borrowAndDeploy: true } : { permit: false, borrowAndDeploy: false };
}
