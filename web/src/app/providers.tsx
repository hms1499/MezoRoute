"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { ErrorToastProvider } from "@/components/ErrorToast";
import { readStoredNetwork, safeStorage } from "@/lib/config/network-choice";
import { NetworkProvider } from "@/lib/config/network-context";
import { networks } from "@/lib/config/networks";
import { createWagmiConfig, walletConnectProjectId } from "@/lib/wallet/passport";

const theme = lightTheme({ accentColor: "#0F766E", borderRadius: "large" });

// Built once per page load (switching networks stores the choice and reloads the page), and outside
// React: wagmi starts reconnecting while it renders, and React may discard a first render with its
// state. A second config would then find wagmi's module-wide reconnect lock held by the discarded
// one, and the wallet would not reconnect after a reload. This module loads only in the browser.
const network = networks[readStoredNetwork(safeStorage())];
const config = createWagmiConfig(network, walletConnectProjectId());
const queryClient = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <NetworkProvider network={network}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={theme}>
            <ErrorToastProvider>
              <AppShell>{children}</AppShell>
            </ErrorToastProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </NetworkProvider>
  );
}
