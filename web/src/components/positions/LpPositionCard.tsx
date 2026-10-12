import Link from "next/link";
import { StatRow } from "@/components/dashboard/StatRow";
import { btc, lp as lpUnits, musd, signedMusd } from "@/components/lp/units";
import { formatPercent } from "@/lib/format";
import { DEFAULT_EXIT_INTENT, exitQuery } from "@/lib/positions/exit-intent";
import type { LpView } from "@/lib/positions/view";

type History = { events: unknown; error: Error | null; retry: () => void };

/** Flow F: what the LP holds, what it would return now, and what it cost (estimates, never "profit"). */
export function LpPositionCard({ lp, history }: { lp: LpView; history: History }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">MUSD/BTC pool</h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="LP balance" sub={`${formatPercent(lp.share, 4)} of the pool`}>
          {lpUnits(lp.balance)}
        </StatRow>
        <StatRow label="Underlying MUSD">{musd(lp.musd)}</StatRow>
        <StatRow label="Underlying BTC" sub={`≈ ${musd(lp.btcValue)}`}>
          {btc(lp.btc)}
        </StatRow>
        <StatRow label="If you exit everything now" sub="Estimated, after the pool fee" strong>
          {lp.exit ? musd(lp.exit.musdOut) : "—"}
        </StatRow>
        <CostRows lp={lp} history={history} />
      </dl>
      {lp.cost && lp.cost.unattributedLp > 0n && (
        <p className="mt-2 text-xs text-muted">
          {lpUnits(lp.cost.unattributedLp)} was not deposited through MezoRoute and has no cost basis.
        </p>
      )}
      <Link
        href={`/positions/lp/exit/${exitQuery(DEFAULT_EXIT_INTENT)}`}
        className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
      >
        Exit to MUSD
      </Link>
    </section>
  );
}

function CostRows({ lp, history }: { lp: LpView; history: History }) {
  if (history.error) {
    return (
      <StatRow label="Cost basis">
        Unavailable{" "}
        <button type="button" onClick={history.retry} className="text-xs font-semibold text-accent hover:underline">
          Retry
        </button>
      </StatRow>
    );
  }
  if (!lp.cost) return <StatRow label="Cost basis">Loading…</StatRow>;
  if (lp.cost.coveredLp === 0n) return <StatRow label="Cost basis">No MezoRoute deposits</StatRow>;
  return (
    <>
      <StatRow label="Cost basis" sub={`incl. ${musd(lp.cost.coveredFees)} MezoRoute fees`}>
        {musd(lp.cost.coveredBasis)}
      </StatRow>
      {lp.valueChange !== null && (
        <StatRow label="Estimated position value change" sub="Exit value minus cost basis">
          {signedMusd(lp.valueChange)}
        </StatRow>
      )}
    </>
  );
}
