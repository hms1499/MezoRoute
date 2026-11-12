"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { MainnetReferenceCard } from "@/components/dashboard/MainnetReferenceCard";
import { RouteComparison } from "@/components/dashboard/RouteComparison";
import { PageHeader } from "@/components/ui/PageHeader";
import { Settle } from "@/components/ui/Settle";
import { LoadingCard } from "@/components/ui/Skeleton";
import { useNetwork } from "@/lib/config/network-context";
import { useDashboardSnapshot } from "@/lib/dashboard/useDashboardSnapshot";

const TITLE = "Compare routes";
const SUBTITLE = "Where to put MUSD: both routes for the same amount, and what each paid over the last 30 days.";

/**
 * U15: Compare routes on its own page, moved off the Dashboard (it was about 45% of it). It reads the same dashboard
 * snapshot, and keeps the testnet "Mainnet today" reference under it.
 * U17 §6: no wallet needed. Without one the snapshot is read for the zero address and the comparison starts from
 * `?amount=` or the 1,000 MUSD example; a wallet only adds its balance as the starting amount.
 */
export default function ComparePage() {
  const { address, status } = useAccount();
  // A remembered wallet reconnecting on load keeps the loading card, so the comparison starts from its balance.
  if (status === "reconnecting") return <LoadingCard label="Connecting wallet" lines={2} />;
  // Not keyed by account (U17 review): this page stays mounted while the snapshot swaps to the connected account, so
  // the amount someone typed before connecting is not thrown away (it is held here, below).
  return <Compare account={address} />;
}

function Compare({ account }: { account: Address | undefined }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const start = useSearchParams().get("amount");
  // U17 review: the comparison card remounts when the snapshot changes (a wallet connecting here), so the field's
  // value lives on the page; null until somebody types, and the card starts from the balance or the example.
  const [draft, setDraft] = useState<string | null>(null);
  const { data, error, refresh } = useDashboardSnapshot(account);
  const connected = account !== undefined;
  return (
    <div className="space-y-6">
      <PageHeader back={{ href: "/", label: "Dashboard" }} title={TITLE} subtitle={SUBTITLE} />
      {connected && chainId !== undefined && chainId !== network.chainId && <WrongNetworkAlert />}
      {data ? (
        <Settle index={0} className="space-y-6">
          <RouteComparison snapshot={data.snapshot} heading={false} start={start} connected={connected} value={draft} onChange={setDraft} />
          <MainnetReferenceCard />
        </Settle>
      ) : error ? (
        <LoadError error={error} onRetry={refresh} />
      ) : (
        <LoadingCard label="Loading the comparison" lines={6} />
      )}
    </div>
  );
}
