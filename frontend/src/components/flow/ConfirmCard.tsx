import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/ui/cx";
import { ActionCard } from "./ActionCard";
import { Overview, type OverviewRow } from "./Overview";

// U11 §6.2: the Confirm page's card. The reviewed amounts with their minimums, the quote block, the full risk list
// (always visible: no risk is hidden before signing), and the steps, whose active button is the page's one primary.
// U14 §A: with `risksPlacement="aside-from-lg"` the risks move to the page's aside from lg (`ConfirmAside`) and stay
// in the card, above the steps, below it; exactly one copy is displayed, and the overview takes two columns.

/** The full risk list under its heading; `idSuffix` keeps the card's and the aside's heading ids apart. */
export function ConfirmRisks({ risks, idSuffix, className }: { risks: readonly string[]; idSuffix: "card" | "aside"; className?: string }) {
  const id = `confirm-risks-${idSuffix}`;
  return (
    <section aria-labelledby={id} className={cx("space-y-2", className)}>
      <h3 id={id} className="flex items-center gap-2 text-sm font-semibold">
        <TriangleAlert aria-hidden className="h-4 w-4 text-warning-ink" />
        Risks
      </h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        {risks.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
    </section>
  );
}

/** A Confirm page's aside: the risks first (from lg only), then the page's facts. */
export function ConfirmAside({ risks, children }: { risks: readonly string[]; children?: ReactNode }) {
  return (
    <>
      <div className="hidden lg:block">
        <Card>
          <ConfirmRisks risks={risks} idSuffix="aside" />
        </Card>
      </div>
      {children}
    </>
  );
}

export function ConfirmCard({
  icon,
  title,
  subtitle,
  overview,
  quote,
  risks,
  steps,
  footnote,
  risksPlacement = "card",
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  overview: OverviewRow[];
  quote?: ReactNode;
  risks: readonly string[];
  steps: ReactNode;
  footnote?: ReactNode;
  risksPlacement?: "card" | "aside-from-lg";
}) {
  const wide = risksPlacement === "aside-from-lg";
  return (
    <ActionCard icon={icon} title={title} subtitle={subtitle}>
      <Overview rows={overview} columns={wide ? 2 : 1} />
      {quote}
      <ConfirmRisks risks={risks} idSuffix="card" className={wide ? "lg:hidden" : undefined} />
      {steps}
      {footnote}
    </ActionCard>
  );
}
