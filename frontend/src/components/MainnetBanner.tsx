"use client";

import { ShieldAlert } from "lucide-react";
import { useNetwork } from "@/lib/config/network-context";
import { explorerAddressUrl } from "@/lib/config/networks";

/**
 * Shown whenever Mainnet is selected (spec §9); it cannot be dismissed. `mt-4` keeps it clear of the
 * sticky header's bottom border (since U4 the header is its own bar, so the banner sat flush against it).
 */
export function MainnetBanner() {
  const { network } = useNetwork();
  if (network.id !== "mainnet") return null;
  return (
    // U13 follow-up: a filled warning band above the hero shouted louder than the page itself. The shield and the
    // sentence carry the warning; the surface stays quiet.
    <p role="note" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-inset border border-line bg-surface px-4 py-2 text-xs text-muted">
      <span className="inline-flex items-center gap-2 font-medium text-ink">
        <ShieldAlert aria-hidden className="h-4 w-4 text-warning-ink" />
        Unaudited · max 1,000 MUSD per transaction
      </span>
      {network.executor && (
        <a
          href={explorerAddressUrl(network, network.executor.address)}
          target="_blank"
          rel="noreferrer"
          className="hit underline underline-offset-2 hover:no-underline"
        >
          Verified contract
        </a>
      )}
    </p>
  );
}
