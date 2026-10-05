"use client";

import { useAccount, useBytecode, useChainId } from "wagmi";
import { isOrangeKitConnector, walletKind, type WalletKind } from "./capabilities";

/**
 * The connected wallet's kind; undefined while it is being checked. The bytecode read targets the
 * app's configured chain (each wagmi config has exactly one), keyed by account and chain.
 */
export function useWalletKind(): WalletKind | undefined {
  const { address, connector } = useAccount();
  const chainId = useChainId();
  const bytecode = useBytecode({ address, chainId, query: { enabled: Boolean(address) } });
  if (!address || !connector) return undefined;
  if (bytecode.isPending && !isOrangeKitConnector(connector)) return undefined;
  return walletKind({
    connectorType: connector.type,
    connectorId: connector.id,
    hasCode: bytecode.isError ? undefined : Boolean(bytecode.data && bytecode.data !== "0x"),
  });
}
