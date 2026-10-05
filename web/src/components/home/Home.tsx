"use client";

import { useAccount } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { ConnectHero } from "./ConnectHero";
import { WalletCard } from "./WalletCard";
import { WrongNetworkAlert } from "./WrongNetworkAlert";

export default function Home() {
  const { status, chainId } = useAccount();
  const { network } = useNetwork();
  if (status === "connecting" || status === "reconnecting") {
    return <p className="text-sm text-muted">Connecting wallet…</p>;
  }
  if (status !== "connected") return <ConnectHero />;
  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <WalletCard />
    </>
  );
}
