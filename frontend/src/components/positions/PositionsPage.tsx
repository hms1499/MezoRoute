"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { BtcMoveChart } from "@/components/chart/BtcMoveChart";
import { ConnectCard } from "@/components/home/ConnectCard";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { btc, musd } from "@/components/lp/units";
import { SpDetails } from "@/components/stability-pool/SpPositionCard";
import { Settle } from "@/components/ui/Settle";
import { StatsStrip } from "@/components/ui/StatsStrip";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingCard } from "@/components/ui/Skeleton";
import { Notice } from "@/components/ui/Notice";
import { useNetwork } from "@/lib/config/network-context";
import { lacksGas } from "@/lib/dashboard/readiness";
import { valueSeries } from "@/lib/exposure/plots";
import { claimBlock } from "@/lib/positions/claim";
import { usePositionsHistory } from "@/lib/positions/usePositionsHistory";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { positionTotals } from "@/lib/positions/totals";
import { positionView, showsNoPositions } from "@/lib/positions/view";
import { spView } from "@/lib/stability-pool/position";
import { spClaimPreview } from "@/lib/stability-pool/preview";
import { useSpActions } from "@/lib/stability-pool/useSpActions";
import { useSpHistory } from "@/lib/stability-pool/useSpHistory";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { GAUGE_READ_FAILED_POSITIONS, GAUGE_READ_FAILED_SUMMARY } from "@/lib/gauge/copy";
import { formatToken } from "@/lib/format";
import { DEFAULT_EXIT_INTENT, exitQuery } from "@/lib/positions/exit-intent";
import { spWithdrawQuery } from "@/lib/stability-pool/intent";
import { LpDetails } from "./LpPositionCard";
import { PositionsTable } from "./PositionsTable";
import { Rewards } from "./Rewards";

const musd2 = (value: bigint) => `${formatToken(value, 18, 2)} MUSD`;

/** Spec §9 screen 5; U11 §6.4: stats, one positions table, one Rewards card, and the totals chart. */
export default function PositionsPage() {
  return (
    <RequireWallet
      fallback={
        <div className="space-y-4">
          <h1 className="text-title">Your positions</h1>
          <ConnectCard />
        </div>
      }
    >
      {(account) => <Positions account={account} />}
    </RequireWallet>
  );
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
  const { gaugeReadFailed } = data.snapshot;
  const totals = positionTotals(view, pool, gaugeReadFailed);
  const header = (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <h1 className="text-title">Your positions</h1>
    </>
  );  if (showsNoPositions(view, pool, gaugeReadFailed)) {
    // U13 follow-up: the empty state keeps the page's left edge and gets a heading of its own, so it reads as this
    // page with nothing in it rather than a centred card floating in a blank canvas.
    return (
      <div className="space-y-4">
        {header}
        <Settle index={0}>
          <Card title="Nothing deposited yet">
            <p className="mt-2 text-sm text-muted">
              You have no MUSD/BTC LP, no unclaimed pool fees, and no Stability Pool deposit on {network.name}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href="/route/lp/" arrow>
                Deposit to LP
              </ButtonLink>
              <ButtonLink href="/route/stability-pool/" variant="secondary">
                Deposit to Stability Pool
              </ButtonLink>
            </div>
          </Card>
        </Settle>
      </div>
    );
  }

  const deposit = pool && !pool.empty ? pool : null;
  const series = valueSeries({ lpValue: view.lp.value, spDeposit: deposit?.deposit ?? 0n, spBtcGain: deposit?.gain ?? 0n, price: data.snapshot.price });
  const spClaim = sp.data ? spClaimPreview({ network, data: sp.data, walletChainId: chainId }) : null;
  const pendingMezo = gaugeReadFailed ? null : (data.snapshot.gauge?.earned ?? 0n);
  // U11 §6.4: stats, one table (LP and Stability Pool rows), one Rewards card, then the totals chart.
  return (
    <div className="space-y-4">
      {header}
      {gaugeReadFailed && (
        <Notice tone="warning" role="status">
          {GAUGE_READ_FAILED_POSITIONS}
        </Notice>
      )}
      <Settle index={0}>
        <StatsStrip
          stats={[
            {
              label: "Total value",
              value: totals ? musd2(totals.value) : "—",
              note: totals ? "at the BTC price, before exit costs" : "Not readable: staked LP could not be read",
            },
            { label: "BTC exposure", value: totals ? btc(totals.btc) : "—", tone: "btc" },
            pendingMezo === null
              ? { label: "Pending MEZO", value: "Not readable", note: GAUGE_READ_FAILED_SUMMARY }
              : { label: "Pending MEZO", value: formatToken(pendingMezo, 18, 4) },
            { label: "Unclaimed pool fees", value: musd2(view.fees.total) },
          ]}
        />
      </Settle>
      <Settle index={1} className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          <PositionsTable
            gaugeReadFailed={gaugeReadFailed}
            lp={
              view.lp.balance > 0n
                ? {
                    amount: view.lp.balance,
                    staked: view.lp.stakedLp,
                    wallet: view.lp.walletLp,
                    value: view.lp.value,
                    earning: view.lp.stakedLp > 0n ? (view.lp.walletLp > 0n ? "MEZO and swap fees" : "MEZO (staked)") : "Swap fees",
                    exitHref: `/positions/lp/exit/${exitQuery(DEFAULT_EXIT_INTENT)}`,
                    details: <LpDetails lp={view.lp} history={history} />,
                  }
                : null
            }
            sp={
              deposit
                ? {
                    deposit: deposit.deposit,
                    value: deposit.value,
                    withdrawHref: `/positions/stability-pool/withdraw/${spWithdrawQuery(100)}`,
                    details: <SpDetails view={deposit} history={spHistory} />,
                  }
                : null
            }
          />
          {sp.error && !sp.data && <LoadError error={sp.error} onRetry={() => void sp.refresh().catch(() => undefined)} />}
        </div>
        <Rewards
          account={account}
          view={view}
          data={data}
          feesBlock={block}
          sp={deposit && sp.data ? { view: deposit, block: spClaim, onClaim: spActions.claim, claiming: spActions.pending === "claim" } : null}
        />
      </Settle>
      {series && (
        <Card level="section" title="Value in MUSD if BTC moves">
          <BtcMoveChart
            well
            className="mt-3"
            plots={[{ title: "Value in MUSD if BTC moves", series, format: (v) => v.toLocaleString("en-US", { maximumFractionDigits: 2 }) }]}
            ariaLabel="Chart of your positions' value in MUSD if BTC moves 30% either way."
          />
        </Card>
      )}
    </div>
  );
}
