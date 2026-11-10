"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { ConnectPage } from "@/components/home/ConnectPage";
import { RequireWallet } from "@/components/home/RequireWallet";
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
 */
export default function ComparePage() {
  return (
    <RequireWallet
      fallback={<ConnectPage back={{ href: "/", label: "Dashboard" }} title={TITLE} cardTitle="Connect to compare routes" cardNote="The comparison uses your wallet's MUSD balance as its starting amount." />}
    >
      {(account) => <Compare account={account} />}
    </RequireWallet>
  );
}

function Compare({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const { data, error, refresh } = useDashboardSnapshot(account);
  return (
    <div className="space-y-6">
      <PageHeader back={{ href: "/", label: "Dashboard" }} title={TITLE} subtitle={SUBTITLE} />
      {chainId !== network.chainId && <WrongNetworkAlert />}
      {data ? (
        <Settle index={0} className="space-y-6">
          <RouteComparison snapshot={data.snapshot} heading={false} />
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
