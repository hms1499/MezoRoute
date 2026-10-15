import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";

export type SummaryRow = { label: string; value: ReactNode; sub?: string; strong?: boolean };

/** The sticky panel: estimated outcome, the block reason right above the action. Below 1024 px the action and notice move to MobileBar. */
export function SummaryPanel({
  title = "Estimated outcome",
  rows,
  empty = "Enter an amount to see the estimate.",
  notice,
  action,
}: {
  title?: string;
  rows: SummaryRow[];
  empty?: string;
  notice?: ReactNode;
  action: ReactNode;
}) {
  return (
    <Card title={title} className="lg:shadow-raised">
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <dl className="stat-list mt-3">
          {rows.map((row) => (
            <Stat key={row.label} label={row.label} sub={row.sub} strong={row.strong}>
              {row.value}
            </Stat>
          ))}
        </dl>
      )}
      {notice && <div className="mt-4 hidden lg:block">{notice}</div>}
      <div className="mt-4 hidden lg:block">{action}</div>
    </Card>
  );
}
