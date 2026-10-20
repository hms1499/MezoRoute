"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, type AvatarComponent, type DisclaimerComponent } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { createContext, memo, useContext, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { ErrorToastProvider } from "@/components/ErrorToast";
import { readStoredNetwork, safeStorage } from "@/lib/config/network-choice";
import { NetworkProvider } from "@/lib/config/network-context";
import { networks } from "@/lib/config/networks";
import { themeColor } from "@/lib/ui/tokens";
import { createWagmiConfig, walletConnectProjectId } from "@/lib/wallet/passport";
import { darkRainbowTheme } from "@/lib/wallet/rainbow-theme";

// A plain wallet glyph instead of RainbowKit's emoji avatar, so the account modal matches the header (U3 §6).
const WalletAvatar: AvatarComponent = ({ size }) => (
  <span
    aria-hidden
    style={{ width: size, height: size, background: themeColor["accent-soft"], color: themeColor.accent }}
    className="flex items-center justify-center rounded-full"
  >
    <Wallet style={{ width: size / 2, height: size / 2 }} />
  </span>
);
// Replaces "New to Ethereum wallets?" on phones (and sits under the intro on desktop): MezoRoute is
// Bitcoin-first, and the modal never said Bitcoin wallets work too (U7).
const WalletDisclaimer: DisclaimerComponent = ({ Text }) => (
  <Text>Use a Bitcoin wallet (Unisat, OKX, Xverse) or an EVM wallet such as MetaMask.</Text>
);
const appInfo = { appName: "MezoRoute", disclaimer: WalletDisclaimer };

// Built once per page load (switching networks stores the choice and reloads the page), and outside
// React: wagmi starts reconnecting while it renders, and React may discard a first render with its
// state. A second config would then find wagmi's module-wide reconnect lock held by the discarded
// one, and the wallet would not reconnect after a reload. This module loads only in the browser.
const network = networks[readStoredNetwork(safeStorage())];
const config = createWagmiConfig(network, walletConnectProjectId());
const queryClient = new QueryClient();

// The current page, passed around the wallet tree so that navigating never re-renders it: without
// SSR, wagmi's Hydrate calls reconnect() on every render of WagmiProvider, and a reconnect drops
// OrangeKit (Bitcoin) wallets, so each page change logged a Unisat user out (found in F3 QA).
const PageContext = createContext<ReactNode>(null);

function Page() {
  return <>{useContext(PageContext)}</>;
}

const WalletTree = memo(function WalletTree() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkRainbowTheme} avatar={WalletAvatar} appInfo={appInfo}>
          <ErrorToastProvider>
            <AppShell>
              <Page />
            </AppShell>
          </ErrorToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
});

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <NetworkProvider network={network}>
      <PageContext.Provider value={children}>
        <WalletTree />
      </PageContext.Provider>
    </NetworkProvider>
  );
}
