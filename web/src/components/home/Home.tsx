"use client";

import { useAccount } from "wagmi";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { ConnectHero } from "./ConnectHero";

export default function Home() {
  const { status, address } = useAccount();
  if (status === "connecting" || status === "reconnecting") {
    return <p className="text-sm text-muted">Connecting wallet…</p>;
  }
  if (status !== "connected" || !address) return <ConnectHero />;
  return <Dashboard account={address} />;
}
