"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useNetwork } from "@/lib/config/network-context";
import { readiness, troveWarning } from "@/lib/dashboard/readiness";
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
import { TroveCard } from "./TroveCard";
import { TroveWarning } from "./TroveWarning";
import { Settle } from "@/components/ui/Settle";

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
      {/* DOM order is the mobile order (the user's own Trove before the comparison), so keyboard order
          follows what is on screen. From 1024 px the side column spans both rows; its 1fr row keeps the
          extra height out of the Next step row. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-[auto_1fr] lg:items-start">
        <Settle index={0} className="lg:col-span-2">
          <ReadinessCard readiness={current} data={data} walletKind={walletKind} account={account} />
        </Settle>
        <Settle index={1} className="space-y-4 lg:col-start-3 lg:row-span-2 lg:row-start-1">
          <ExposurePanel snapshot={snapshot} />
          <TroveCard snapshot={snapshot} borrowable={current.borrowable} health={current.health} />
          <PositionsSummary account={account} spValue={exposure(snapshot).spValue} />
        </Settle>
        <Settle index={2} className="lg:col-span-2 lg:row-start-2">
          <RouteComparison snapshot={snapshot} />
        </Settle>
      </div>
      <MainnetReferenceCard />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your positions" className="space-y-4">
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
