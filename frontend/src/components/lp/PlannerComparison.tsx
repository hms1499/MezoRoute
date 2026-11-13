import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Term } from "@/components/ui/Term";
import { PLANNER_COMPARE_NOTE, type PlannerCompare, type PlannerCompareRow } from "@/lib/flow/planner-comparison";
import { formatToken } from "@/lib/format";
import { cx } from "@/lib/ui/cx";

// U13 §Comparison card, U17 §2: the same amount on both routes, from the planner's own snapshot, on both planners.
// `other` is the route this page is not: it names the card and its one secondary action; the page keeps the only
// accent button, and its own route is listed first. The Stability Pool side never shows a rate.

const LINK = "font-medium text-accent underline underline-offset-2 hover:text-accent-hover";

export function PlannerComparison({
  amountMusd,
  example,
  state,
  other,
  otherHref,
  historyHref,
}: {
  amountMusd: bigint;
  example: boolean;
  state: { kind: "rows"; rows: PlannerCompare } | { kind: "message"; message: string };
  other: "sp" | "lp";
  /** The other route's planner with this amount; null in the message state. */
  otherHref: string | null;
  /** `/compare/` with this amount: what each route paid over the last 30 days. */
  historyHref: string;
}) {
  const lp = state.kind === "rows" && <Route name="MUSD/BTC LP" tone="accent" rows={state.rows.lp} />;
  const sp = state.kind === "rows" && <Route name="Stability Pool" tone="sp" rows={state.rows.sp} />;
  // U19: Mezo's Savings Vault, read-only, after both routes.
  const savings = state.kind === "rows" && state.rows.savings && <Route name="Savings Vault (sMUSD)" tone="neutral" rows={state.rows.savings} />;
  return (
    <Card
      title={
        other === "sp" ? (
          <>
            Compare with the <Term id="stabilityPool">Stability Pool</Term>
          </>
        ) : (
          "Compare with the MUSD/BTC LP"
        )
      }
      aside={
        // No amount to show when the field holds none: a zero badge would read as an amount the visitor typed.
        state.kind === "rows" ? (
          <div className="text-right">
            <Badge>{formatToken(amountMusd, 18, 2)} MUSD</Badge>
            {example && <p className="mt-1 text-xs text-muted">Example amount</p>}
          </div>
        ) : undefined
      }
    >
      {state.kind === "message" ? (
        <p className="mt-3 text-sm text-muted">{state.message}</p>
      ) : (
        <div className="mt-4 space-y-5">
          {other === "sp" ? lp : sp}
          {other === "sp" ? sp : lp}
          {savings}
        </div>
      )}
      <p className="mt-4 text-xs text-muted">
        {PLANNER_COMPARE_NOTE}{" "}
        <Link href={historyHref} className={LINK}>
          30-day results for both routes
        </Link>
      </p>
      {otherHref !== null && (
        <ButtonLink href={otherHref} variant="secondary" size="md" className="mt-4 w-full">
          {/* The Dashboard's Compare card names this action the same. The card's own heading carries the comparison. */}
          {other === "sp" ? "Choose Stability Pool" : "Choose MUSD/BTC LP"}
        </ButtonLink>
      )}
    </Card>
  );
}

/** One route: a coloured dot, then label/value rows. */
function Route({ name, tone, rows }: { name: string; tone: "accent" | "sp" | "neutral"; rows: PlannerCompareRow[] }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden className={cx("h-2 w-2 rounded-full", tone === "accent" ? "bg-accent" : tone === "sp" ? "bg-sp" : "bg-muted")} />
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
