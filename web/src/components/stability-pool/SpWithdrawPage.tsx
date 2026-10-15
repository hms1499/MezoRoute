"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount, useSimulateContract } from "wagmi";
import { Stat } from "@/components/ui/Stat";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { btc, musd } from "@/components/lp/units";
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

const pill = (on: boolean) =>
  on ? "rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white" : "rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted";

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
      <div aria-busy="true" aria-label="Loading your deposit" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
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

  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <section className="card">
        <h1 className="text-lg font-semibold">Withdraw from the Stability Pool</h1>
        <fieldset className="mt-4" disabled={busy}>
          <legend className="text-sm font-medium">Amount to withdraw</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {EXIT_PERCENTS.map((value) => (
              <button key={value} type="button" aria-pressed={value === props.percent} onClick={() => props.onPercent(value)} className={pill(value === props.percent)}>
                {value === 100 ? "Max" : `${value}%`}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Your deposit: {musd(props.data.snapshot.dashboard.sp.deposit)}</p>
        </fieldset>
      </section>
      <section className="card">
        <dl className="stat-list">
          <Stat label="MUSD to withdraw (estimated)" strong>
            {musd(preview.amount)}
          </Stat>
          <Stat label="Deposit after">{musd(preview.depositAfter)}</Stat>
          <Stat label="BTC gain paid with it">{btc(preview.gainPaid)}</Stat>
          <Stat label="MezoRoute fee">None</Stat>
          <Stat label="Network fee (estimated)">{preview.gasCost === null ? "—" : btc(preview.gasCost)}</Stat>
        </dl>
      </section>
      {paused ? (
        <section role="status" className="card">
          <p className="text-sm text-danger">{SP_WITHDRAW_BLOCKED.message}</p>
          <p className="mt-1 text-xs text-muted">Claiming your BTC gain still works while withdrawals are paused.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={claimBlock !== null || busy}
              onClick={actions.claim}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {actions.pending === "claim" ? "Check your wallet…" : "Claim BTC gain"}
            </button>
            <button type="button" onClick={() => void check.refetch()} className="text-xs font-semibold text-accent hover:underline">
              Retry
            </button>
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BlockNotice block={preview.block} />
          {/* A pending gain can be taken without touching the deposit, even when nothing is left to withdraw. */}
          {claimBlock === null && (
            <button
              type="button"
              disabled={busy}
              onClick={actions.claim}
              className="ml-auto rounded-full border border-accent px-5 py-2.5 text-sm font-semibold text-accent hover:bg-accent-soft disabled:opacity-50"
            >
              {actions.pending === "claim" ? "Check your wallet…" : "Claim BTC gain only"}
            </button>
          )}
          <button
            type="button"
            disabled={preview.block !== null || busy || check.isPending}
            onClick={() => actions.withdraw(props.percent)}
            className={`${claimBlock === null ? "" : "ml-auto "}rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50`}
          >
            {actions.pending === "withdraw" ? "Check your wallet…" : "Withdraw"}
          </button>
        </div>
      )}
      <Link href="/positions/" className="inline-block text-xs font-semibold text-accent hover:underline">
        Back to positions
      </Link>
    </>
  );
}
