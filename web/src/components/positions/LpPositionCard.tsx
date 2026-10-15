import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { btc, lp as lpUnits, musd, signedMusd } from "@/components/lp/units";
import { formatPercent } from "@/lib/format";
import { DEFAULT_EXIT_INTENT, exitQuery } from "@/lib/positions/exit-intent";
import type { LpView } from "@/lib/positions/view";

type History = { events: unknown; error: Error | null; retry: () => void };

/** Flow F: what the LP holds, what it would return now, and what it cost (estimates, never "profit"). */
export function LpPositionCard({ lp, history }: { lp: LpView; history: History }) {
  return (
    <Card title="MUSD/BTC pool" aside={<span className="text-lg font-semibold">{musd(lp.value)}</span>}>
      <dl className="mt-3 stat-list">
        <Stat label="LP balance" sub={`${formatPercent(lp.share, 4)} of the pool`}>
          {lpUnits(lp.balance)}
        </Stat>
        <Stat label="Underlying MUSD">{musd(lp.musd)}</Stat>
        <Stat label="Underlying BTC" sub={`≈ ${musd(lp.btcValue)}`}>
          {btc(lp.btc)}
        </Stat>
        <Stat label="If you exit everything now" sub="Estimated, after the pool fee" strong>
          {lp.exit ? musd(lp.exit.musdOut) : "—"}
        </Stat>
        <CostRows lp={lp} history={history} />
      </dl>
      {lp.cost && lp.cost.unattributedLp > 0n && (
        <p className="mt-2 text-xs text-muted">
          {lpUnits(lp.cost.unattributedLp)} was not deposited through MezoRoute and has no cost basis.
        </p>
      )}
      <ButtonLink href={`/positions/lp/exit/${exitQuery(DEFAULT_EXIT_INTENT)}`} className="mt-4">
        Exit to MUSD
      </ButtonLink>
    </Card>
  );
}

function CostRows({ lp, history }: { lp: LpView; history: History }) {
  if (history.error) {
    return (
      <Stat label="Cost basis">
        Unavailable{" "}
        <Button size="sm" variant="ghost" onClick={history.retry}>
          Retry
        </Button>
      </Stat>
    );
  }
  if (!lp.cost) return <Stat label="Cost basis"><Skeleton className="ml-auto h-4 w-24" /></Stat>;
  if (lp.cost.coveredLp === 0n) return <Stat label="Cost basis">No MezoRoute deposits</Stat>;
  return (
    <>
      <Stat label="Cost basis" sub={`incl. ${musd(lp.cost.coveredFees)} MezoRoute fees`}>
        {musd(lp.cost.coveredBasis)}
      </Stat>
      {lp.valueChange !== null && (
        <Stat label="Estimated position value change" sub="Exit value minus cost basis">
          {signedMusd(lp.valueChange)}
        </Stat>
      )}
    </>
  );
}
