"use client";

import { Inbox } from "lucide-react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { btc, musd } from "@/components/lp/units";
import { SpPositionCard } from "@/components/stability-pool/SpPositionCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingCard } from "@/components/ui/Skeleton";
import { useNetwork } from "@/lib/config/network-context";
import { lacksGas } from "@/lib/dashboard/readiness";
import { claimBlock } from "@/lib/positions/claim";
import { usePositionsHistory } from "@/lib/positions/usePositionsHistory";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { positionTotals } from "@/lib/positions/totals";
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

  // A failed Stability Pool read shows its own error; it never hides the LP cards.
  const spFailed = !sp.data && sp.error !== null;
  if (!data || (!sp.data && !spFailed)) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <LoadingCard label="Loading your positions" lines={5} />
    );
  }

  const view = positionView(data.snapshot, history.events ?? null);
  const pool = sp.data ? spView(sp.data.snapshot, spHistory.basis) : null;
  const block = claimBlock({
    network,
    walletChainId: chainId,
    fees: data.snapshot.fees,
    lacksGas: lacksGas(data.gasBalance, data.gasPrice),
  });
  const totals = positionTotals(view, pool);
  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Your positions</h1>
        {totals && !(view.empty && pool?.empty) && (
          <dl className="flex gap-6 text-right">
            <div>
              <dt className="text-xs text-muted">Value (estimated)</dt>
              <dd className="text-lg font-semibold">{musd(totals.value)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">BTC exposure</dt>
              <dd className="text-lg font-semibold text-btc">{btc(totals.btc)}</dd>
            </div>
          </dl>
        )}
      </div>
      {view.empty && pool?.empty ? (
        <Card className="text-center">
          <Inbox aria-hidden className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 text-sm">You have no MUSD/BTC LP, no unclaimed pool fees, and no Stability Pool deposit on {network.name}.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <ButtonLink href="/route/lp/">Deposit MUSD into the pool</ButtonLink>
            <ButtonLink href="/route/stability-pool/" variant="secondary">
              Back the system
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <>
          {view.lp.balance > 0n && <LpPositionCard lp={view.lp} history={history} />}
          {!view.empty && <FeesCard account={account} fees={view.fees} block={block} />}
          {sp.error && !sp.data && <LoadError error={sp.error} onRetry={() => void sp.refresh().catch(() => undefined)} />}
          {sp.data && pool && !pool.empty && (
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
