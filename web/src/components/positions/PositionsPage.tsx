"use client";

import { Inbox } from "lucide-react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { BtcMoveChart } from "@/components/chart/BtcMoveChart";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { btc, musd } from "@/components/lp/units";
import { RouteLayout } from "@/components/route/RouteLayout";
import { SpPositionCard } from "@/components/stability-pool/SpPositionCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Column } from "@/components/ui/Column";
import { Stat } from "@/components/ui/Stat";
import { LoadingCard } from "@/components/ui/Skeleton";
import { useNetwork } from "@/lib/config/network-context";
import { lacksGas } from "@/lib/dashboard/readiness";
import { valueSeries } from "@/lib/exposure/plots";
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
  const header = (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight">Your positions</h1>
    </>
  );
  if (view.empty && pool?.empty) {
    return (
      <Column>
        {header}
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
      </Column>
    );
  }

  const deposit = pool && !pool.empty ? pool : null;
  const series = valueSeries({ lpValue: view.lp.value, spDeposit: deposit?.deposit ?? 0n, spBtcGain: deposit?.gain ?? 0n, price: data.snapshot.price });
  // The same columns as the flows (U3 §5.3): positions on the left, totals and the move chart on the right.
  return (
    <RouteLayout
      header={header}
      summary={
        totals && (
          <Card title="Totals">
            <dl className="stat-list mt-3">
              <Stat label="Value at the BTC price" sub="Oracle price, before exit costs" strong>
                {musd(totals.value)}
              </Stat>
              <Stat label="BTC exposure in these positions" tone="btc">
                {btc(totals.btc)}
              </Stat>
            </dl>
            {series && (
              <BtcMoveChart
                well
                className="mt-5"
                plots={[{ title: "Value in MUSD if BTC moves", series, format: (v) => v.toLocaleString("en-US", { maximumFractionDigits: 2 }) }]}
                ariaLabel="Chart of your positions' value in MUSD if BTC moves 30% either way."
              />
            )}
          </Card>
        )
      }
    >
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
    </RouteLayout>
  );
}
