import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { btc, lp as lpUnits, musd, signedMusd } from "@/components/lp/units";
import { formatPercent } from "@/lib/format";
import { showsExitGap } from "@/lib/positions/labels";
import type { LpView } from "@/lib/positions/view";
import { Settle } from "@/components/ui/Settle";

type History = { events: unknown; error: Error | null; retry: () => void };

/** Flow F: what the LP holds, what it would return now, and what it cost (estimates, never "profit"); U11 §6.4 shows it as the LP row's details. */
export function LpDetails({ lp, history }: { lp: LpView; history: History }) {
  return (
    <div className="space-y-2">
      <dl className="stat-list grid-cols-[minmax(8rem,1fr)_minmax(0,auto)]">
        <Stat label="LP balance" sub={`${formatPercent(lp.share, 4)} of the pool`}>
          {lpUnits(lp.balance)}
        </Stat>
        <Stat label="Underlying MUSD">{musd(lp.musd)}</Stat>
        <Stat label="Underlying BTC" sub={`≈ ${musd(lp.btcValue)}`}>
          {btc(lp.btc)}
        </Stat>
        <Stat label="Exit to MUSD now" sub="Estimated, after the pool fee and price impact" strong>
          {lp.exit ? musd(lp.exit.musdOut) : "—"}
        </Stat>
        <CostRows lp={lp} history={history} />
      </dl>
      {lp.exit && showsExitGap(lp.value, lp.exit.musdOut) && (
        <p className="text-sm text-muted">Exiting sells the BTC half at the pool price, which differs from the oracle.</p>
      )}
      {lp.cost && lp.cost.unattributedLp > 0n && (
        <p className="text-sm text-muted">{lpUnits(lp.cost.unattributedLp)} was not deposited through MezoRoute and has no cost basis.</p>
      )}
      {lp.stakedLp > 0n && <p className="text-sm text-muted">Exit unstakes the staked LP it needs first. Your pending MEZO stays claimable.</p>}
    </div>
  );
}

function CostRows({ lp, history }: { lp: LpView; history: History }) {
  if (history.error) {
    return (
      <Stat label="Cost basis">
        Unavailable{" "}
        <Button size="md" variant="ghost" onClick={history.retry}>
          Retry
        </Button>
      </Stat>
    );
  }
  if (!lp.cost) {
    return (
      <Stat label="Cost basis">
        <span role="status" className="inline-flex items-center gap-2 text-xs text-muted">
          Reading your history…
          <Skeleton className="h-4 w-16" />
        </span>
      </Stat>
    );
  }
  if (lp.cost.coveredLp === 0n) return <Stat label="Cost basis">No MezoRoute deposits</Stat>;
  return (
    <>
      <Stat label="Cost basis" sub={`incl. ${musd(lp.cost.coveredFees)} MezoRoute fees`}>
        <Settle as="span">{musd(lp.cost.coveredBasis)}</Settle>
      </Stat>
      {lp.valueChange !== null && (
        <Stat label="Estimated position value change" sub="Exit value minus cost basis">
          <Settle as="span" index={1}>
            {signedMusd(lp.valueChange)}
          </Settle>
        </Stat>
      )}
    </>
  );
}
