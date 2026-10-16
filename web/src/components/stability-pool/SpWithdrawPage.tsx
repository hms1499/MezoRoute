"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount, useSimulateContract } from "wagmi";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { btc, musd } from "@/components/lp/units";
import { MobileBar, RouteLayout } from "@/components/route/RouteLayout";
import { SummaryPanel } from "@/components/route/SummaryPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingCard } from "@/components/ui/Skeleton";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import { useNetwork } from "@/lib/config/network-context";
import { decodeError } from "@/lib/errors/decode";
import { SP_WITHDRAW_BLOCKED } from "@/lib/errors/outcomes";
import { EXIT_PERCENTS, type ExitPercent } from "@/lib/positions/exit-intent";
import { parseSpWithdrawPercent, spWithdrawQuery } from "@/lib/stability-pool/intent";
import { spClaimPreview, spWithdrawPreview } from "@/lib/stability-pool/preview";
import type { SpData } from "@/lib/stability-pool/snapshot";
import { useSpActions } from "@/lib/stability-pool/useSpActions";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { useWalletKind } from "@/lib/wallet/useWalletKind";

const chip = (on: boolean) =>
  on
    ? "min-h-9 rounded-full bg-accent px-3.5 text-sm font-semibold text-onAccent"
    : "min-h-9 rounded-full border border-line px-3.5 text-sm font-semibold text-muted hover:text-ink";

/** Spec §9 screen 6b: share or Max, simulated first; a paused pool shows the blocked state with Claim BTC gain. */
export default function SpWithdrawPage() {
  return <RequireWallet>{(account) => <SpWithdraw account={account} />}</RequireWallet>;
}

function SpWithdraw({ account }: { account: Address }) {
  const searchParams = useSearchParams();
  const [percent, setPercent] = useState<ExitPercent>(() => parseSpWithdrawPercent(searchParams));
  const { data, error, refresh } = useSpSnapshot(account);
  if (!data) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <LoadingCard label="Loading your deposit" />
    );
  }
  return (
    <WithdrawView
      account={account}
      data={data}
      refresh={refresh}
      percent={percent}
      onPercent={(next) => {
        setPercent(next);
        window.history.replaceState(null, "", spWithdrawQuery(next));
      }}
    />
  );
}

function WithdrawView(props: {
  account: Address;
  data: SpData;
  refresh: () => Promise<SpData>;
  percent: ExitPercent;
  onPercent: (next: ExitPercent) => void;
}) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const actions = useSpActions(props.account, props.refresh);
  const preview = spWithdrawPreview({ network, data: props.data, percent: props.percent, walletKind: walletKind ?? "unknown", walletChainId: chainId });
  const claimBlock = spClaimPreview({ network, data: props.data, walletChainId: chainId });
  // Simulated on load: a pool paused by an under-collateralised Trove is shown before any signing.
  const check = useSimulateContract({
    address: network.addresses.stabilityPool,
    abi: stabilityPoolAbi,
    functionName: "withdrawFromSP",
    args: [preview.amount],
    account: props.account,
    chainId: network.chainId,
    // A revert is deterministic; retrying it only delays the paused state by ~7 s.
    query: { enabled: preview.block === null, retry: false },
  });
  const paused = check.error !== null && decodeError(check.error, network).kind === SP_WITHDRAW_BLOCKED.kind;
  const busy = actions.pending !== null;

  const claimLabel = actions.pending === "claim" ? "Check your wallet…" : "Claim BTC gain";
  const withdrawButton = (className?: string) => (
    <Button
      disabled={preview.block !== null || busy || check.isPending}
      loading={actions.pending === "withdraw"}
      onClick={() => actions.withdraw(props.percent)}
      className={className}
    >
      {actions.pending === "withdraw" ? "Check your wallet…" : "Withdraw"}
    </Button>
  );
  const notice = preview.block?.outcome ? <BlockNotice block={preview.block} /> : undefined;
  const rows = [
    { label: "MUSD to withdraw (estimated)", value: musd(preview.amount), strong: true },
    { label: "Deposit after", value: musd(preview.depositAfter) },
    { label: "BTC gain paid with it", value: btc(preview.gainPaid) },
    { label: "MezoRoute fee", value: "None" },
    { label: "Network fee (estimated)", value: preview.gasCost === null ? "—" : btc(preview.gasCost) },
  ];

  return (
    <RouteLayout
      header={<PageHeader back={{ href: "/positions/", label: "Positions" }} title="Withdraw from the Stability Pool" />}
      summary={
        paused ? (
          <Card title="Withdrawals are paused">
            <Notice tone="danger" role="status" className="mt-3">
              {SP_WITHDRAW_BLOCKED.message}
            </Notice>
            <p className="mt-3 text-sm text-muted">Claiming your BTC gain still works while withdrawals are paused.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled={claimBlock !== null || busy} loading={actions.pending === "claim"} onClick={actions.claim}>
                {claimLabel}
              </Button>
              <Button variant="ghost" onClick={() => void check.refetch()}>
                Retry
              </Button>
            </div>
          </Card>
        ) : (
          <SummaryPanel
            title="Summary"
            rows={rows}
            notice={notice}
            action={
              <div className="space-y-2">
                {withdrawButton("w-full")}
                {/* A pending gain can be taken without touching the deposit, even when nothing is left to withdraw. */}
                {claimBlock === null && (
                  <Button variant="secondary" disabled={busy} loading={actions.pending === "claim"} onClick={actions.claim} className="w-full">
                    {actions.pending === "claim" ? "Check your wallet…" : "Claim BTC gain only"}
                  </Button>
                )}
              </div>
            }
          />
        )
      }
      mobileBar={paused ? undefined : <MobileBar figure={musd(preview.amount)} notice={notice} action={withdrawButton()} />}
    >
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <Card>
        <fieldset disabled={busy}>
          <legend className="text-sm font-medium">Amount to withdraw</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXIT_PERCENTS.map((value) => (
              <button key={value} type="button" aria-pressed={value === props.percent} onClick={() => props.onPercent(value)} className={chip(value === props.percent)}>
                {value === 100 ? "Max" : `${value}%`}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">Your deposit: {musd(props.data.snapshot.dashboard.sp.deposit)}</p>
        </fieldset>
      </Card>
      {claimBlock === null && !paused && (
        <div className="lg:hidden">
          <Button variant="secondary" disabled={busy} loading={actions.pending === "claim"} onClick={actions.claim} className="w-full">
            {actions.pending === "claim" ? "Check your wallet…" : "Claim BTC gain only"}
          </Button>
        </div>
      )}
    </RouteLayout>
  );
}
