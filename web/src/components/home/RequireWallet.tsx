"use client";

import type { ReactNode } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { ConnectHero } from "./ConnectHero";

/** Renders `children` for a connected account; otherwise the reconnecting note or the connect hero. */
export function RequireWallet({ children }: { children: (account: Address) => ReactNode }) {
  const { status, address } = useAccount();
  if (status === "connecting" || status === "reconnecting") {
    return <p className="text-sm text-muted">Connecting wallet…</p>;
  }
  if (status !== "connected" || !address) return <ConnectHero />;
  return <>{children(address)}</>;
}
