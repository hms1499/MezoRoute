"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useNetwork } from "@/lib/config/network-context";
import { readiness, troveWarning } from "@/lib/dashboard/readiness";
import { summaryItems } from "@/lib/dashboard/summary";
import { useDashboardSnapshot, type DashboardData } from "@/lib/dashboard/useDashboardSnapshot";
import { dashboardView } from "@/lib/dashboard/view";
import { exposure } from "@/lib/exposure/exposure";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { ExposurePanel } from "./ExposurePanel";
import { MainnetReferenceCard } from "./MainnetReferenceCard";
import { PositionsSummary } from "./PositionsSummary";
import { ReadinessCard } from "./ReadinessCard";
import { RouteComparison } from "./RouteComparison";
import { SummaryStrip } from "./SummaryStrip";
import { TroveCard } from "./TroveCard";
import { TroveWarning } from "./TroveWarning";

/** The connected home page (spec §9 screen 1): warning, readiness, Trove, exposure, route comparison, positions, mainnet reference (testnet only). */
export function Dashboard({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const { data, error, refresh } = useDashboardSnapshot(account);
  const view = dashboardView({ hasData: data !== undefined, walletKindKnown: walletKind !== undefined, hasError: error !== null });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      {chainId !== network.chainId && <WrongNetworkAlert />}
      {view === "content" && data && walletKind && <DashboardBody data={data} walletKind={walletKind} account={account} />}
      {view === "error" && error && <LoadError error={error} onRetry={refresh} />}
      {view === "loading" && <DashboardSkeleton />}
    </div>
  );
}

function DashboardBody({ data, walletKind, account }: { data: DashboardData; walletKind: WalletKind; account: Address }) {
  const { snapshot, gasBalance, gasPrice } = data;
  const current = readiness({ snapshot, gasBalance, gasPrice, walletKind });
  const warning = troveWarning(current.health, snapshot.protocol.mcr);
  return (
    <>
      {warning && <TroveWarning warning={warning} />}
      <SummaryStrip items={summaryItems(data)} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          <ReadinessCard readiness={current} data={data} walletKind={walletKind} account={account} />
          <RouteComparison snapshot={snapshot} />
        </div>
        <div className="space-y-4">
          <ExposurePanel snapshot={snapshot} />
          <TroveCard snapshot={snapshot} borrowable={current.borrowable} health={current.health} />
          <PositionsSummary account={account} spValue={exposure(snapshot).spValue} />
        </div>
      </div>
      <MainnetReferenceCard />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your positions" className="space-y-4">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={6} />
        </div>
        <div className="space-y-4">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    </div>
  );
}
