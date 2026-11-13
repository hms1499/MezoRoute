"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { TroveWarning } from "@/components/dashboard/TroveWarning";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { LoadingCard } from "@/components/ui/Skeleton";
import { useNetwork } from "@/lib/config/network-context";
import { troveWarning } from "@/lib/dashboard/readiness";
import { useTroveSnapshot } from "@/lib/leverage/useTroveSnapshot";
import { troveHealth } from "@/lib/trove/health";
import { trovePageState } from "@/lib/trove/page";
import { readTroveView, writeTroveView, type TroveView } from "@/lib/trove/view-pref";
import { NoTroveView } from "./NoTroveView";
import { BorrowingCard, MezoNowCard, QueueCard } from "./TroveAsideCards";
import { TroveChangeCard } from "./TroveChangeCard";
import { TroveCrChart } from "./TroveCrChart";
import { TroveNotices } from "./TroveNotices";
import { TroveSummaryCard } from "./TroveSummaryCard";

// U20 (spec 2026-11-13-u20-trove-tab-design.md): the Trove's own page, after Liquity V2's loan screen. Read on the
// selected network, with the zero address before a wallet connects (nothing then reads as the visitor's).

const WITH_TROVE = "Your MUSD loan on Mezo, backed by BTC. Unwind, Close, and Leverage each run in one transaction through MezoRoute; anything else opens the Mezo app.";
const WITHOUT_TROVE =
  "A Trove is a MUSD loan on Mezo, backed by BTC you lock in it. MezoRoute can open one with leverage, and later unwind, leverage, or close it, each in one transaction.";

export default function TrovePage() {
  const { network } = useNetwork();
  const { address, status } = useAccount();
  const { data, error, queue, queueLoading, refresh } = useTroveSnapshot(address);
  const [view, setView] = useState<TroveView>(readTroveView);
  const state = useMemo(() => (data ? trovePageState({ snapshot: data.snapshot, queue: queueLoading ? "loading" : queue, account: address, network }) : null), [data, queue, queueLoading, address, network]);

  const header = (subtitle: string) => (
    <div className="space-y-3">
      <h1 className="text-title">Trove</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>
    </div>
  );
  if (status === "reconnecting" || status === "connecting") return <LoadingCard label="Loading your Trove" />;
  const loadingLabel = address ? "Loading your Trove" : "Loading Mezo's Trove rules";
  if (!data || !state) {
    return (
      <div className="space-y-6">
        {header(address ? WITH_TROVE : WITHOUT_TROVE)}
        {error ? (
          <Notice
            tone="danger"
            role="alert"
            action={
              <Button variant="secondary" size="md" onClick={() => void refresh().catch(() => undefined)}>
                Retry
              </Button>
            }
          >
            Could not read the Trove from Mezo just now.
          </Notice>
        ) : (
          <LoadingCard label={loadingLabel} />
        )}
      </div>
    );
  }

  const snapshot = data.snapshot;
  const onRefresh = () => void refresh().catch(() => undefined);
  if (state.kind === "none") {
    return (
      <div className="space-y-6">
        {header(WITHOUT_TROVE)}
        {address && <TroveNotices account={address} snapshot={snapshot} />}
        <NoTroveView snapshot={snapshot} open={state.open} connected={address !== undefined} network={network} />
      </div>
    );
  }

  const warning = troveWarning(troveHealth(state.summary.cr, snapshot.market.mcr), snapshot.market.mcr);
  return (
    <div className="space-y-6">
      {header(WITH_TROVE)}
      {warning && <TroveWarning warning={warning} />}
      {address && <TroveNotices account={address} snapshot={snapshot} />}
      <TroveSummaryCard
        snapshot={snapshot}
        summary={state.summary}
        view={view}
        onView={(next) => {
          setView(next);
          writeTroveView(next);
        }}
        onRefresh={onRefresh}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <TroveChangeCard network={network} />
          <TroveCrChart snapshot={snapshot} />
        </div>
        <aside className="space-y-6">
          <QueueCard redemption={state.summary.redemption} />
          <BorrowingCard snapshot={snapshot} />
          <MezoNowCard snapshot={snapshot} />
        </aside>
      </div>
    </div>
  );
}
