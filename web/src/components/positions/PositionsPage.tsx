"use client";

import Link from "next/link";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { SpPositionCard } from "@/components/stability-pool/SpPositionCard";
import { useNetwork } from "@/lib/config/network-context";
import { lacksGas } from "@/lib/dashboard/readiness";
import { claimBlock } from "@/lib/positions/claim";
import { usePositionsHistory } from "@/lib/positions/usePositionsHistory";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { positionView } from "@/lib/positions/view";
import { spView } from "@/lib/stability-pool/position";
import { spClaimPreview } from "@/lib/stability-pool/preview";
import { useSpActions } from "@/lib/stability-pool/useSpActions";
import { useSpHistory } from "@/lib/stability-pool/useSpHistory";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { FeesCard } from "./FeesCard";
import { LpPositionCard } from "./LpPositionCard";

/** Spec §9 screen 5: LP, pool fees, and the Stability Pool. */
export default function PositionsPage() {
  return <RequireWallet>{(account) => <Positions account={account} />}</RequireWallet>;
}

function Positions({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const { data, error, refresh } = usePositionsSnapshot(account);
  const sp = useSpSnapshot(account);
  const history = usePositionsHistory(account);
  const spHistory = useSpHistory(account, sp.data?.snapshot.initialDeposit);
  const spActions = useSpActions(account, sp.refresh);

  if (!data || !sp.data) {
    const failed = error ?? sp.error;
    return failed ? (
      <LoadError
        error={failed}
        onRetry={() => {
          void refresh().catch(() => undefined);
          void sp.refresh().catch(() => undefined);
        }}
      />
    ) : (
      <div aria-busy="true" aria-label="Loading your positions" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
    );
  }

  const view = positionView(data.snapshot, history.events ?? null);
  const pool = spView(sp.data.snapshot, spHistory.basis);
  const block = claimBlock({
    network,
    walletChainId: chainId,
    fees: data.snapshot.fees,
    lacksGas: lacksGas(data.gasBalance, data.gasPrice),
  });
  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <h1 className="text-lg font-semibold">Your positions</h1>
      {view.empty && pool.empty ? (
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-sm">You have no MUSD/BTC LP, no unclaimed pool fees, and no Stability Pool deposit on {network.name}.</p>
          <div className="mt-3 flex gap-4">
            <Link href="/route/lp/" className="text-xs font-semibold text-accent hover:underline">
              Deposit MUSD into the pool
            </Link>
            <Link href="/route/stability-pool/" className="text-xs font-semibold text-accent hover:underline">
              Back the system in the Stability Pool
            </Link>
          </div>
        </section>
      ) : (
        <>
          {view.lp.balance > 0n && <LpPositionCard lp={view.lp} history={history} />}
          {!view.empty && <FeesCard account={account} fees={view.fees} block={block} />}
          {!pool.empty && (
            <SpPositionCard
              view={pool}
              history={spHistory}
              claimBlock={spClaimPreview({ network, data: sp.data, walletChainId: chainId })}
              onClaim={spActions.claim}
              claiming={spActions.pending === "claim"}
            />
          )}
        </>
      )}
    </>
  );
}
