import Link from "next/link";
import { StatRow } from "@/components/dashboard/StatRow";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { btc, musd, signedMusd } from "@/components/lp/units";
import type { HistoryStatus } from "@/lib/stability-pool/cost-basis";
import type { SpBlock } from "@/lib/stability-pool/gate";
import { spWithdrawQuery } from "@/lib/stability-pool/intent";
import type { SpView } from "@/lib/stability-pool/position";

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
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Stability Pool</h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="Deposit now" sub="After absorbed liquidations">
          {musd(view.deposit)}
        </StatRow>
        <StatRow label="Pending BTC gain" sub={`≈ ${musd(view.gainValue)}`}>
          {btc(view.gain)}
        </StatRow>
        <StatRow label="Value now (estimated)" strong>
          {musd(view.value)}
        </StatRow>
        <CostRows view={view} history={history} />
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/positions/stability-pool/withdraw/${spWithdrawQuery(100)}`}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
        >
          Withdraw
        </Link>
        <button
          type="button"
          disabled={claimBlock !== null || claiming}
          onClick={onClaim}
          className="rounded-full border border-accent px-5 py-2.5 text-sm font-semibold text-accent hover:bg-accent-soft disabled:opacity-50"
        >
          {claiming ? "Check your wallet…" : "Claim BTC gain"}
        </button>
        <BlockNotice block={claimBlock?.reason === "no-gain" ? null : claimBlock} />
      </div>
    </section>
  );
}

function CostRows({ view, history }: { view: SpView; history: History }) {
  if (history.status === "unavailable") {
    return (
      <StatRow label="Cost basis">
        Unavailable{" "}
        <button type="button" onClick={history.retry} className="text-xs font-semibold text-accent hover:underline">
          Retry
        </button>
      </StatRow>
    );
  }
  if (history.status === "updating") return <StatRow label="Cost basis">Updating…</StatRow>;
  if (!view.cost) return <StatRow label="Cost basis">Loading…</StatRow>;
  return (
    <>
      <StatRow label="Cost basis" sub="MUSD you put in, less what you took out">
        {musd(view.cost.basis)}
      </StatRow>
      <StatRow label="Estimated position value change" sub="Value now minus cost basis">
        {signedMusd(view.cost.valueChange)}
      </StatRow>
      <StatRow label="BTC gains received" sub="Since this deposit started">
        {btc(view.cost.gainsClaimed)}
      </StatRow>
      <StatRow label="Absorbed by liquidations" sub="Since this deposit started">
        {musd(view.cost.absorbed)}
      </StatRow>
    </>
  );
}
