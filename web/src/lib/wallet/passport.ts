import {
  getConfig,
  okxWalletMezoMainnet,
  okxWalletMezoTestnet,
  unisatWalletMezoMainnet,
  unisatWalletMezoTestnet,
  xverseWalletMezoMainnet,
  xverseWalletMezoTestnet,
} from "@mezo-org/passport";
import { injectedWallet, metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { createStorage } from "wagmi";
import { safeStorage } from "@/lib/config/network-choice";
import type { NetworkConfig } from "@/lib/config/networks";

// OrangeKit's Bitcoin connectors are bound to one chain and RPC, so each network has its own set.
const bitcoinWallets = {
  testnet: [unisatWalletMezoTestnet, okxWalletMezoTestnet, xverseWalletMezoTestnet],
  mainnet: [unisatWalletMezoMainnet, okxWalletMezoMainnet, xverseWalletMezoMainnet],
};

/**
 * wagmi config for one Mezo network through Mezo Passport: Bitcoin wallets (OrangeKit) and EVM
 * wallets. Passport builds one chain per config, so switching networks reloads the page and builds
 * a new config; the per-network storage key lets each network reconnect its own wallet.
 */
export function createWagmiConfig(network: NetworkConfig, walletConnectProjectId: string) {
  return getConfig({
    appName: "MezoRoute",
    mezoNetwork: network.id,
    walletConnectProjectId,
    wallets: [
      { groupName: "Bitcoin", wallets: bitcoinWallets[network.id] },
      { groupName: "Ethereum", wallets: [metaMaskWallet, walletConnectWallet, injectedWallet] },
    ],
    storage: createStorage({ key: `mezoroute.${network.id}`, storage: safeStorage() }),
  });
}

export function walletConnectProjectId(): string {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!id) throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set (see web/.env.example)");
  return id;
}
