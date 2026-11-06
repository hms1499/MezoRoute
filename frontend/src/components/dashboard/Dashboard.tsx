"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useNetwork } from "@/lib/config/network-context";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { StatsStrip } from "@/components/ui/StatsStrip";
import { writeBlocker, writeBlockerMessage } from "@/lib/config/write-gate";
import { readiness, readinessCopy, troveWarning } from "@/lib/dashboard/readiness";
import { dashboardStats, lpReturns } from "@/lib/dashboard/stats";
import { formatPercent, formatToken } from "@/lib/format";
import { stakeAvailability } from "@/lib/gauge/availability";
import { GAUGE_READ_FAILED_SUMMARY } from "@/lib/gauge/copy";
import { emissionsApr } from "@/lib/gauge/maths";
import { useMezoPrice } from "@/lib/gauge/useMezoPrice";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { positionView } from "@/lib/positions/view";
import { spView } from "@/lib/stability-pool/position";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { isOrangeKitConnector } from "@/lib/wallet/capabilities";
import { walletKindNote } from "@/lib/wallet/labels";
import { useDashboardSnapshot, type DashboardData } from "@/lib/dashboard/useDashboardSnapshot";
import { dashboardView } from "@/lib/dashboard/view";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { DashboardHeader } from "./DashboardHeader";
import { ExposurePanel } from "./ExposurePanel";
import { MainnetReferenceCard } from "./MainnetReferenceCard";
import { RouteComparison } from "./RouteComparison";
import { RoutesTable } from "./RoutesTable";
import { TroveCard } from "./TroveCard";
import { TroveWarning } from "./TroveWarning";
import { useWalletLine } from "./useWalletLine";
import { YourPositionsTable } from "./YourPositionsTable";
import { Settle } from "@/components/ui/Settle";

/** The connected home page (spec §9 screen 1; U11 §6.3): header, warning, stats strip, positions and routes tables, exposure and Trove, route comparison, mainnet reference (testnet only). */
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
  const { network } = useNetwork();
  const { connector, chainId } = useAccount();
  const { snapshot, gasBalance, gasPrice } = data;
  const current = readiness({ snapshot, gasBalance, gasPrice, walletKind });
  const warning = troveWarning(current.health, snapshot.protocol.mcr);
  const wallet = useWalletLine(walletKind, account);
  // Positions' own reads, so the first stat is exactly the total Positions shows (U11 §6.3).
  const positions = usePositionsSnapshot(account);
  const sp = useSpSnapshot(account);
  const mezoPrice = useMezoPrice(network, snapshot.block?.number);
  const view = positions.data ? positionView(positions.data.snapshot, null) : null;
  const pool = sp.data ? spView(sp.data.snapshot, null) : null;
  const stats = dashboardStats({
    snapshot,
    health: current.health,
    totals: view && positions.data ? { view, pool, gaugeReadFailed: positions.data.snapshot.gaugeReadFailed } : null,
  });
  const availability = stakeAvailability(snapshot.gauge, snapshot.block?.timestamp ?? 0n);
  const { lp } = snapshot;
  const apr =
    availability === "open" && snapshot.gauge
      ? emissionsApr({
          rewardRate: snapshot.gauge.rewardRate,
          mezoPrice,
          userLp: 0n,
          totalStaked: snapshot.gauge.totalStaked,
          pool: { reserveMusd: lp.reserveMusd, reserveBtc: lp.reserveBtc, balanceMusd: lp.reserveMusd, balanceBtc: lp.reserveBtc, totalSupply: lp.totalSupply },
        })
      : null;
  const copy = readinessCopy(current, { musd: snapshot.musd, walletKind, network });
  const notes = [
    walletKindNote(walletKind, connector ? isOrangeKitConnector(connector) : false),
    writeBlocker(network, chainId) === "no-executor" ? writeBlockerMessage("no-executor", network) : null,
  ].filter((note): note is string => note !== null);
  const gaugeFailed = snapshot.gaugeReadFailed;
  const lpRow = view && view.lp.balance > 0n
    ? {
        value: view.lp.value,
        staked: view.lp.stakedLp,
        wallet: view.lp.walletLp,
        earning: view.lp.stakedLp > 0n ? (view.lp.walletLp > 0n ? "MEZO and swap fees" : "MEZO (staked)") : "Swap fees",
        note: positions.data?.snapshot.gaugeReadFailed ? GAUGE_READ_FAILED_SUMMARY : null,
      }
    : null;
  const crValue = stats.troveCr === "none" ? "No Trove" : stats.troveCr.value === null ? "—" : formatPercent(stats.troveCr.value, 1);

  return (
    <>
      <DashboardHeader wallet={wallet.line} title={wallet.title} />
      {warning && <TroveWarning warning={warning} />}
      {notes.map((note) => (
        <Notice key={note}>{note}</Notice>
      ))}
      {/* What the Next step card said when there is nothing to deploy yet: how to get gas, MUSD, or a Trove. */}
      {current.state !== "ready" && (
        <Notice
          tone={copy.tone === "attention" ? "warning" : "neutral"}
          action={
            current.state === "can-borrow" && network.executor ? (
              <ButtonLink href="/route/lp/?mode=borrow" variant="secondary" size="md">
                Borrow & Deploy
              </ButtonLink>
            ) : copy.actions?.[0] ? (
              <ButtonLink href={copy.actions[0].href} external variant="secondary" size="md">
                {copy.actions[0].label}
              </ButtonLink>
            ) : undefined
          }
        >
          <span className="font-semibold">{copy.headline}</span>
          {copy.detail && <> {copy.detail}</>}
        </Notice>
      )}
      <Settle index={0}>
        <StatsStrip
          stats={[
            {
              label: "Positions value",
              value: stats.positionsValue === null ? "—" : `${formatToken(stats.positionsValue, 18, 2)} MUSD`,
              note: positions.data?.snapshot.gaugeReadFailed ? "Not readable: staked LP could not be read" : "at the BTC price",
            },
            {
              label: "BTC exposure",
              value: `${formatToken(stats.btcExposure)} BTC`,
              tone: "btc",
              note: gaugeFailed ? GAUGE_READ_FAILED_SUMMARY : undefined,
            },
            stats.pendingMezo === null
              ? { label: "Pending MEZO", value: "Not readable", note: GAUGE_READ_FAILED_SUMMARY }
              : { label: "Pending MEZO", value: formatToken(stats.pendingMezo, 18, 4) },
            {
              label: "Trove CR",
              value: crValue,
              tone: stats.troveCr !== "none" && stats.troveCr.atRisk ? "danger" : undefined,
            },
          ]}
        />
      </Settle>
      <Settle index={1} className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <YourPositionsTable
          lp={lpRow}
          sp={pool && !pool.empty ? { value: pool.value } : null}
          trove={snapshot.trove ? { debt: snapshot.trove.debt, manageHref: network.mezoAppUrl } : null}
          gaugeReadFailed={positions.data?.snapshot.gaugeReadFailed ?? false}
        />
        <RoutesTable
          lpReturns={lpReturns({ availability, apr, poolFeeBps: snapshot.poolFeeBps })}
          walletMusd={snapshot.musd}
          lpHref="/route/lp/"
          spHref="/route/stability-pool/"
        />
      </Settle>
      <Settle index={2} className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <ExposurePanel snapshot={snapshot} />
        <TroveCard snapshot={snapshot} borrowable={current.borrowable} health={current.health} />
      </Settle>
      <Settle index={3}>
        <RouteComparison snapshot={snapshot} />
      </Settle>
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
