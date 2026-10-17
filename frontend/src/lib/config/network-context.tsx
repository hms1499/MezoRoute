"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { safeStorage, switchNetworkAndReload } from "./network-choice";
import type { NetworkConfig, NetworkId } from "./networks";

type NetworkContextValue = { network: NetworkConfig; switchNetwork: (id: NetworkId) => void };

const NetworkContext = createContext<NetworkContextValue | null>(null);

/** Provides the network chosen at page load; switching stores the new choice and reloads the page. */
export function NetworkProvider({ network, children }: { network: NetworkConfig; children: ReactNode }) {
  const value = useMemo<NetworkContextValue>(
    () => ({
      network,
      switchNetwork: (id) => switchNetworkAndReload(network.id, id, safeStorage(), () => window.location.reload()),
    }),
    [network],
  );
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkContextValue {
  const value = useContext(NetworkContext);
  if (!value) throw new Error("useNetwork must be used inside NetworkProvider");
  return value;
}
