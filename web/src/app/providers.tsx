"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, memo, useContext, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { ErrorToastProvider } from "@/components/ErrorToast";
import { readStoredNetwork, safeStorage } from "@/lib/config/network-choice";
import { NetworkProvider } from "@/lib/config/network-context";
import { networks } from "@/lib/config/networks";
import { colors } from "@/lib/ui/tokens";
import { createWagmiConfig, walletConnectProjectId } from "@/lib/wallet/passport";

// The wallet button and modal match the app's buttons (U1): theme options only, no CSS into the library.
const baseTheme = lightTheme({ accentColor: colors.accent.DEFAULT, accentColorForeground: "white", borderRadius: "large" });
const theme = { ...baseTheme, fonts: { body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" } };

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
        <RainbowKitProvider theme={theme}>
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
