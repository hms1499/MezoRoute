"use client";

import { useBitcoinAccount } from "@mezo-org/passport";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { shortAddress } from "@/lib/format";
import { isOrangeKitConnector, type WalletKind } from "@/lib/wallet/capabilities";
import { walletKindLabel } from "@/lib/wallet/labels";

/** The connected wallet in one line ("MetaMask · standard wallet · 0x375a…d6e8"), with the full address as its title. */
export function useWalletLine(walletKind: WalletKind, account: Address): { line: string; title: string } {
  const { connector } = useAccount();
  const { btcAddress } = useBitcoinAccount();
  const bitcoinWallet = connector ? isOrangeKitConnector(connector) : false;
  return {
    line: `${connector?.name ?? "Wallet"} · ${walletKindLabel(walletKind, bitcoinWallet)} · ${shortAddress(account)}`,
    title: btcAddress ?? account,
  };
}
