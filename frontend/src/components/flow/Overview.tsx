import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// U11 §6.1: the transaction overview, a bordered box of label/value rows (label sm/500 muted, value right-aligned).

export type OverviewRow = { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "btc" | "positive" | "negative" };

const TONE: Record<NonNullable<OverviewRow["tone"]>, string> = { btc: "text-btc", positive: "text-positive", negative: "text-negative" };

export function Overview({ rows, className }: { rows: OverviewRow[]; className?: string }) {
  return (
    <dl className={cx("rounded-inset border border-line px-4", className)}>
      {rows.map((row, index) => (
        <div key={index} className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-b-0">
          <dt className="text-sm font-medium text-muted">{row.label}</dt>
          <dd className={cx("text-right text-sm font-medium", row.tone ? TONE[row.tone] : "text-ink")}>
            {row.value}
            {row.sub && <span className="block text-xs font-normal text-muted">{row.sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
