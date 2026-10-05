"use client";

import { useNetwork } from "@/lib/config/network-context";

/** Shown whenever Mainnet is selected (spec §9); it cannot be dismissed. */
export function MainnetBanner() {
  const { network } = useNetwork();
  if (network.id !== "mainnet") return null;
  return (
    <p role="note" className="rounded-xl bg-warning-bg px-3 py-2 text-xs text-warning-ink">
      ⚠ Unaudited · max 1,000 MUSD per transaction
    </p>
  );
}
