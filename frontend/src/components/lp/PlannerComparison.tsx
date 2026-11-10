import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Term } from "@/components/ui/Term";
import { PLANNER_COMPARE_NOTE, type PlannerCompare, type PlannerCompareRow } from "@/lib/flow/planner-comparison";
import { formatToken } from "@/lib/format";
import { cx } from "@/lib/ui/cx";

// U13 §Comparison card: the same amount on both routes, from the planner's own snapshot. One secondary action (the
// Stability Pool deposit); the page keeps the only accent button. The Stability Pool side never shows a rate.

export function PlannerComparison({
  amountMusd,
  example,
  state,
  spHref,
}: {
  amountMusd: bigint;
  example: boolean;
  state: { kind: "rows"; rows: PlannerCompare } | { kind: "message"; message: string };
  spHref: string | null;
}) {
  return (
    <Card
      title={
        <>
          Compare with the <Term id="stabilityPool">Stability Pool</Term>
        </>
      }
      aside={
        <div className="text-right">
          <Badge>{formatToken(amountMusd, 18, 2)} MUSD</Badge>
          {example && <p className="mt-1 text-xs text-muted">Example amount</p>}
        </div>
      }
    >
      {state.kind === "message" ? (
        <p className="mt-3 text-sm text-muted">{state.message}</p>
      ) : (
        <div className="mt-4 space-y-5">
          <Route name="MUSD/BTC LP" tone="accent" rows={state.rows.lp} />
          <Route name="Stability Pool" tone="sp" rows={state.rows.sp} />
        </div>
      )}
      <p className="mt-4 text-xs text-muted">{PLANNER_COMPARE_NOTE}</p>
      {spHref !== null && (
        <ButtonLink href={spHref} variant="secondary" size="md" className="mt-4 w-full">
          Deposit to Stability Pool instead
        </ButtonLink>
      )}
    </Card>
  );
}

/** One route: a coloured dot, then label/value rows. */
function Route({ name, tone, rows }: { name: string; tone: "accent" | "sp"; rows: PlannerCompareRow[] }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden className={cx("h-2 w-2 rounded-full", tone === "accent" ? "bg-accent" : "bg-sp")} />
        {name}
      </h3>
      <dl className="mt-2 space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3">
            <dt className="text-muted">{row.label}</dt>
            <dd className="text-right">
              {row.value}
              {row.sub && <span className="block text-xs text-muted">{row.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
