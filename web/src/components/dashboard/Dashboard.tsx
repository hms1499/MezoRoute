"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { Column } from "@/components/ui/Column";
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

/** The connected home page (spec §9 screen 1): warning, readiness, Trove, exposure, route comparison, positions, mainnet reference (testnet only). */
export function Dashboard({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const { data, error, refresh } = useDashboardSnapshot(account);
  const view = dashboardView({ hasData: data !== undefined, walletKindKnown: walletKind !== undefined, hasError: error !== null });

  return (
    <Column>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      {view === "content" && data && walletKind && <DashboardBody data={data} walletKind={walletKind} account={account} />}
      {view === "error" && error && <LoadError error={error} onRetry={refresh} />}
      {view === "loading" && <DashboardSkeleton />}
    </Column>
  );
}

function DashboardBody({ data, walletKind, account }: { data: DashboardData; walletKind: WalletKind; account: Address }) {
  const { snapshot, gasBalance, gasPrice } = data;
  const current = readiness({ snapshot, gasBalance, gasPrice, walletKind });
  const warning = troveWarning(current.health, snapshot.protocol.mcr);
  return (
    <>
      {warning && <TroveWarning warning={warning} />}
      <ReadinessCard readiness={current} data={data} walletKind={walletKind} account={account} />
      <TroveCard snapshot={snapshot} borrowable={current.borrowable} health={current.health} />
      <ExposurePanel snapshot={snapshot} />
      <RouteComparison snapshot={snapshot} />
      <PositionsSummary account={account} spValue={exposure(snapshot).spValue} />
      <MainnetReferenceCard />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your positions" className="space-y-4">
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-32 animate-pulse rounded-2xl bg-white shadow-card" />
      ))}
    </div>
  );
}
