"use client";

import { useAccount, useBytecode } from "wagmi";
import { walletKind, type WalletKind } from "@/lib/wallet/capabilities";

export function useWalletKind(): WalletKind | undefined {
  const { address, connector } = useAccount();
  const { data: bytecode, isPending } = useBytecode({ address, query: { enabled: Boolean(address) } });
  if (!address || !connector || isPending) return undefined;
  return walletKind({
    connectorType: connector.type,
    connectorId: connector.id,
    hasCode: Boolean(bytecode && bytecode !== "0x"),
  });
}
