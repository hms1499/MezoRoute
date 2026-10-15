"use client";

import type { ReactNode } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { LoadingCard } from "@/components/ui/Skeleton";
import { ConnectCard } from "./ConnectCard";

/** Renders `children` for a connected account; otherwise a loading card while reconnecting, or `fallback` (default: ConnectCard). */
export function RequireWallet({ children, fallback }: { children: (account: Address) => ReactNode; fallback?: ReactNode }) {
  const { status, address } = useAccount();
  if (status === "connecting" || status === "reconnecting") return <LoadingCard label="Connecting wallet" lines={2} />;
  if (status !== "connected" || !address) return <>{fallback ?? <ConnectCard />}</>;
  return <>{children(address)}</>;
}
