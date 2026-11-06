import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { ActionCard } from "./ActionCard";
import { Overview, type OverviewRow } from "./Overview";

// U11 §6.2: the Confirm page's card. The reviewed amounts with their minimums, the quote block, the full risk list
// (always visible: no risk is hidden before signing), and the steps, whose active button is the page's one primary.

export function ConfirmCard({
  icon,
  title,
  subtitle,
  overview,
  quote,
  risks,
  steps,
  footnote,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  overview: OverviewRow[];
  quote?: ReactNode;
  risks: readonly string[];
  steps: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <ActionCard icon={icon} title={title} subtitle={subtitle}>
      <Overview rows={overview} />
      {quote}
      <section aria-labelledby="confirm-risks" className="space-y-2">
        <h3 id="confirm-risks" className="flex items-center gap-2 text-sm font-semibold">
          <TriangleAlert aria-hidden className="h-4 w-4 text-warning-ink" />
          Risks
        </h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {risks.map((risk) => (
            <li key={risk}>{risk}</li>
          ))}
        </ul>
      </section>
      {steps}
      {footnote}
    </ActionCard>
  );
}
