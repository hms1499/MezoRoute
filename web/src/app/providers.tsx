"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { readStoredNetwork, safeStorage } from "@/lib/config/network-choice";
import { NetworkProvider } from "@/lib/config/network-context";
import { networks } from "@/lib/config/networks";
import { createWagmiConfig, walletConnectProjectId } from "@/lib/wallet/passport";

const theme = lightTheme({ accentColor: "#0F766E", borderRadius: "large" });

export default function Providers({ children }: { children: ReactNode }) {
  // Read once per page load: switching networks stores the choice and reloads the page.
  const [network] = useState(() => networks[readStoredNetwork(safeStorage())]);
  const [config] = useState(() => createWagmiConfig(network, walletConnectProjectId()));
  const [queryClient] = useState(() => new QueryClient());
  return (
    <NetworkProvider network={network}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={theme}>{children}</RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </NetworkProvider>
  );
}
