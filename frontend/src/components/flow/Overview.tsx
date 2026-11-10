import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// U11 §6.1: the transaction overview, a bordered box of label/value rows (label sm/500 muted, value right-aligned).
// U13 follow-up: a row may name a `group`; consecutive rows of the same group share one caption and a hairline, so a
// Confirm card reads as "You pay / You receive / Terms" instead of a flat wall of eight equal rows.

export type OverviewRow = { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "btc" | "positive" | "negative" | "warning"; group?: string };

// `warning` (U14 B3): a figure that is still allowed but costly (price impact from 1%), never a signed result.
const TONE: Record<NonNullable<OverviewRow["tone"]>, string> = { btc: "text-btc", positive: "text-positive", negative: "text-negative", warning: "text-warning-ink" };

/** `columns={2}` lays two or more groups side by side from lg, in source order (U14: a Confirm card at page width). */
export function Overview({ rows, className, columns = 1 }: { rows: OverviewRow[]; className?: string; columns?: 1 | 2 }) {
  const groups = rows.reduce<{ label: string | null; rows: OverviewRow[] }[]>((all, row) => {
    const label = row.group ?? null;
    const last = all[all.length - 1];
    if (last && last.label === label) last.rows.push(row);
    else all.push({ label, rows: [row] });
    return all;
  }, []);
  // One group (the Trove Confirm's rows) has nothing to sit beside: two columns would leave it in half the card.
  const split = columns === 2 && groups.length > 1;
  return (
    <div className={cx("rounded-inset border border-line px-4", split && "grid grid-cols-1 lg:grid-cols-2 lg:gap-x-6", className)}>
      {groups.map((group, groupIndex) => (
        <div key={`${group.label ?? "rows"}-${groupIndex}`} className={cx(groupIndex > 0 && "border-t border-line", split && groupIndex === 1 && "lg:border-t-0")}>
          {group.label && <p className="pt-2 text-xs font-medium text-muted">{group.label}</p>}
          <dl>
            {group.rows.map((row, index) => (
              // At 360 two columns squeezed both sides; the label sits above its value there.
              <div key={index} className="flex flex-col gap-0.5 border-b border-line py-2 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                {/* The value column took its content's width and squeezed short labels into two lines. */}
                <dt className="shrink-0 text-sm font-medium text-muted">{row.label}</dt>
                {/* No `text-wrap: balance` here: it split "123.6015" from "MUSD" to even out the lines. */}
                <dd className={cx("min-w-0 text-left text-sm font-medium sm:text-right", row.tone ? TONE[row.tone] : "text-ink")}>
                  {row.value}
                  {row.sub && <span className="block text-xs font-normal text-muted">{row.sub}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
