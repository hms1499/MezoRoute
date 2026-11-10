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
import { ActionCard } from "@/components/flow/ActionCard";
import { FlowColumn, FlowState } from "@/components/flow/FlowColumn";
import { Overview } from "@/components/flow/Overview";
import { TokenAmountInput } from "@/components/flow/TokenAmountInput";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { LoadingCard } from "@/components/ui/Skeleton";
import { Term } from "@/components/ui/Term";
import { stabilityPoolAbi } from "@/lib/abi/musd";
import { useNetwork } from "@/lib/config/network-context";
import { decodeError } from "@/lib/errors/decode";
import { SP_WITHDRAW_BLOCKED } from "@/lib/errors/outcomes";
import { formatToken } from "@/lib/format";
import { EXIT_PERCENTS, type ExitPercent } from "@/lib/positions/exit-intent";
import { parseSpWithdrawPercent, spWithdrawQuery } from "@/lib/stability-pool/intent";
import { spClaimPreview, spWithdrawPreview } from "@/lib/stability-pool/preview";
import type { SpData } from "@/lib/stability-pool/snapshot";
import { useSpActions } from "@/lib/stability-pool/useSpActions";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { useWalletKind } from "@/lib/wallet/useWalletKind";

/** Spec §9 screen 6b: share or Max, simulated first; a paused pool shows the blocked state with Claim BTC gain. U11 §6.2: one action card. */
export default function SpWithdrawPage() {
  return <RequireWallet flow>{(account) => <SpWithdraw account={account} />}</RequireWallet>;
}

function SpWithdraw({ account }: { account: Address }) {
  const searchParams = useSearchParams();
  const [percent, setPercent] = useState<ExitPercent>(() => parseSpWithdrawPercent(searchParams));
  const { data, error, refresh } = useSpSnapshot(account);
  if (!data) {
    return error ? (
      <FlowState><LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} /></FlowState>
    ) : (
      <FlowState><LoadingCard label="Loading your deposit" /></FlowState>
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

  const rows = [
    { label: "Deposit after", value: musd(preview.depositAfter) },
    { label: "BTC gain paid with it", value: btc(preview.gainPaid) },
    { label: "MezoRoute fee", value: "None" },
    { label: "Network fee (estimated)", value: preview.gasCost === null ? "—" : btc(preview.gasCost) },
  ];
  const claimOnly = claimBlock === null && (
    // A pending gain can be taken without touching the deposit, even when nothing is left to withdraw.
    <Button variant="secondary" disabled={busy} pending={actions.pending === "claim" ? "wallet" : null} onClick={actions.claim} className="w-full">
      Claim BTC gain only
    </Button>
  );

  return (
    <FlowColumn
      header={
        <PageHeader
          back={{ href: "/positions/", label: "Positions" }}
          title={
            <>
              Withdraw from the <Term id="stabilityPool">Stability Pool</Term>
            </>
          }
        />
      }
    >
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <ActionCard
        icon={<TokenIcon token="musd" size={24} />}
        title="Withdraw MUSD"
        subtitle="Stability Pool"
        figure="No MezoRoute fee"
        action={
          paused ? undefined : (
            <div className="grid gap-2">
              <Button
                disabled={preview.block !== null || busy || check.isPending}
                pending={actions.pending === "withdraw" ? "wallet" : null}
                onClick={() => actions.withdraw(props.percent)}
                className="w-full"
              >
                Withdraw
              </Button>
              {claimOnly}
            </div>
          )
        }
      >
        <TokenAmountInput
          id="withdraw-amount"
          label="You withdraw (estimated)"
          amount={formatToken(preview.amount, 18, 4)}
          token="musd"
          balance={props.data.snapshot.dashboard.sp.deposit}
          balanceLabel="Your deposit"
          max={null}
          percent={{ value: props.percent, presets: EXIT_PERCENTS, label: "Amount to withdraw", disabled: busy, onPreset: (next) => props.onPercent(next as ExitPercent) }}
        />
        {/* The paused state keeps the summary: what the deposit and its gain are, and that Claim still works. */}
        <Overview rows={rows} />
        {paused ? (
          <div className="space-y-3">
            <Notice tone="danger" role="status">
              <span className="font-semibold">Withdrawals are paused.</span> {SP_WITHDRAW_BLOCKED.message}
            </Notice>
            <p className="text-sm text-muted">Claiming your BTC gain still works while withdrawals are paused.</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={claimBlock !== null || busy} pending={actions.pending === "claim" ? "wallet" : null} onClick={actions.claim}>
                Claim BTC gain
              </Button>
              <Button variant="ghost" onClick={() => void check.refetch()}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <BlockNotice block={preview.block} />
        )}
      </ActionCard>
    </FlowColumn>
  );
}
