import type { SummaryItem } from "@/lib/dashboard/summary";
import { cx } from "@/lib/ui/cx";

export function SummaryStrip({ items }: { items: SummaryItem[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-white px-4 py-3">
          <dt className="text-xs text-muted">{item.label}</dt>
          <dd className={cx("mt-1 truncate text-lg font-semibold", item.tone === "btc" && "text-btc")} title={item.value}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
