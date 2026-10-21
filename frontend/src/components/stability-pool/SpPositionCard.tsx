import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { Term } from "@/components/ui/Term";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { btc, musd, signedMusd } from "@/components/lp/units";
import type { HistoryStatus } from "@/lib/stability-pool/cost-basis";
import type { SpBlock } from "@/lib/stability-pool/gate";
import { spWithdrawQuery } from "@/lib/stability-pool/intent";
import type { SpView } from "@/lib/stability-pool/position";
import { Settle } from "@/components/ui/Settle";

type History = { status: HistoryStatus; retry: () => void };

/** Flow F, Stability Pool part: deposit, pending BTC gain, what it cost (estimates, never "profit"). */
export function SpPositionCard({
  view,
  history,
  claimBlock,
  onClaim,
  claiming,
}: {
  view: SpView;
  history: History;
  claimBlock: SpBlock | null;
  onClaim: () => void;
  claiming: boolean;
}) {
  return (
    <Card title={<Term id="stabilityPool">Stability Pool</Term>} aside={<span className="font-mono text-xl font-medium">{musd(view.value)}</span>}>
      <dl className="mt-3 stat-list">
        <Stat label="Deposit now" sub="After absorbed liquidations">
          {musd(view.deposit)}
        </Stat>
        <Stat
          label={
            <>
              Pending <Term id="btcGain">BTC gain</Term>
            </>
          }
          sub={`≈ ${musd(view.gainValue)}`}
        >
          {btc(view.gain)}
        </Stat>
        <Stat label="Value now (estimated)" strong>
          {musd(view.value)}
        </Stat>
        <CostRows view={view} history={history} />
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ButtonLink href={`/positions/stability-pool/withdraw/${spWithdrawQuery(100)}`} arrow>Withdraw</ButtonLink>
        <Button variant="secondary" disabled={claimBlock !== null} pending={claiming ? "wallet" : null} onClick={onClaim}>
          Claim BTC gain
        </Button>
        <BlockNotice block={claimBlock?.reason === "no-gain" ? null : claimBlock} />
      </div>
    </Card>
  );
}

function CostRows({ view, history }: { view: SpView; history: History }) {
  if (history.status === "unavailable") {
    return (
      <Stat label="Cost basis">
        Unavailable{" "}
        <Button size="sm" variant="ghost" onClick={history.retry}>
          Retry
        </Button>
      </Stat>
    );
  }
  if (history.status === "updating" || !view.cost) {
    return (
      <Stat label="Cost basis">
        <span role="status" className="inline-flex items-center gap-2 text-xs text-muted">
          Reading your history…
          <Skeleton className="h-4 w-16" />
        </span>
      </Stat>
    );
  }
  return (
    <>
      <Stat label="Cost basis" sub="MUSD you put in, less what you took out">
        <Settle as="span" index={0}>
          {musd(view.cost.basis)}
        </Settle>
      </Stat>
      <Stat label="Estimated position value change" sub="Value now minus cost basis">
        <Settle as="span" index={1}>
          {signedMusd(view.cost.valueChange)}
        </Settle>
      </Stat>
      <Stat label="BTC gains received" sub="Since this deposit started">
        <Settle as="span" index={2}>
          {btc(view.cost.gainsClaimed)}
        </Settle>
      </Stat>
      <Stat label="Absorbed by liquidations" sub="Since this deposit started">
        <Settle as="span" index={3}>
          {musd(view.cost.absorbed)}
        </Settle>
      </Stat>
    </>
  );
}
