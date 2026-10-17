"use client";

import type { ReactNode } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { LoadingCard } from "@/components/ui/Skeleton";
import { requireWalletView } from "@/lib/wallet/require-wallet";
import { ConnectCard } from "./ConnectCard";

/** Renders `children` for a connected account; a loading card while a remembered wallet reconnects; otherwise `fallback` (default: ConnectCard), kept behind the wallet modal while the user connects. */
export function RequireWallet({ children, fallback }: { children: (account: Address) => ReactNode; fallback?: ReactNode }) {
  const { status, address } = useAccount();
  const view = requireWalletView(status, address !== undefined);
  if (view === "loading") return <LoadingCard label="Connecting wallet" lines={2} />;
  if (view === "fallback" || !address) return <>{fallback ?? <ConnectCard />}</>;
  return <>{children(address)}</>;
}
