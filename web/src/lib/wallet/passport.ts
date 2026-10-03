import {
  getConfig,
  okxWalletMezoTestnet,
  unisatWalletMezoTestnet,
  xverseWalletMezoTestnet,
} from "@mezo-org/passport";
import { injectedWallet, metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";

/** wagmi config for Mezo testnet through Mezo Passport: Bitcoin wallets (OrangeKit) and EVM wallets. */
export function createWagmiConfig(walletConnectProjectId: string) {
  return getConfig({
    appName: "MezoRoute",
    mezoNetwork: "testnet",
    walletConnectProjectId,
    wallets: [
      { groupName: "Bitcoin", wallets: [unisatWalletMezoTestnet, okxWalletMezoTestnet, xverseWalletMezoTestnet] },
      { groupName: "Ethereum", wallets: [metaMaskWallet, walletConnectWallet, injectedWallet] },
    ],
  });
}

export function walletConnectProjectId(): string {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!id) throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set (see web/.env.example)");
  return id;
}
