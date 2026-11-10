"use client";

import type { ReactNode } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { FlowState } from "@/components/flow/FlowColumn";
import { LoadingCard } from "@/components/ui/Skeleton";
import { requireWalletView } from "@/lib/wallet/require-wallet";
import { ConnectCard } from "./ConnectCard";

/**
 * Renders `children` for a connected account; a loading card while a remembered wallet reconnects; otherwise
 * `fallback` (default: ConnectCard), kept behind the wallet modal while the user connects. On a flow route (`flow`)
 * both states sit in `FlowState`, on the card's edge and width (U14).
 */
export function RequireWallet({ children, fallback, flow = false }: { children: (account: Address) => ReactNode; fallback?: ReactNode; flow?: boolean }) {
  const { status, address } = useAccount();
  const view = requireWalletView(status, address !== undefined);
  const frame = (node: ReactNode) => (flow ? <FlowState>{node}</FlowState> : <>{node}</>);
  if (view === "loading") return frame(<LoadingCard label="Connecting wallet" lines={2} />);
  if (view === "fallback" || !address) return fallback !== undefined ? <>{fallback}</> : frame(<ConnectCard />);
  return <>{children(address)}</>;
}
