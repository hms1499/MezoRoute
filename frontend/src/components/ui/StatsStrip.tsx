import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// U11 §6.1: a panel of 3–4 stats (xs label, xl/500 value), split by hairlines from 768 px and a 2 × 2 grid below.

export type StripStat = { label: ReactNode; value: ReactNode; tone?: "btc" | "danger"; note?: ReactNode };

const TONE = { btc: "text-btc", danger: "text-danger" } as const;

export function StatsStrip({ stats, className }: { stats: StripStat[]; className?: string }) {
  return (
    <dl className={cx("card grid grid-cols-2 gap-4 md:flex md:gap-0 md:divide-x md:divide-line", className)}>
      {stats.map((stat, index) => (
        <div key={index} className="min-w-0 md:flex-1 md:px-4 md:first:pl-0 md:last:pr-0">
          <dt className="text-xs text-muted">{stat.label}</dt>
          <dd className="mt-1">
            <span className={cx("block break-words text-xl font-medium", stat.tone && TONE[stat.tone])}>{stat.value}</span>
            {stat.note && <span className="mt-0.5 block text-xs text-muted">{stat.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
