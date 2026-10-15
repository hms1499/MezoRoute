"use client";

import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { landingLive } from "@/lib/reference/landing";
import { useMainnetReference } from "@/lib/reference/useMainnetReference";

/** Mezo mainnet today, read through F8's own client (no wallet needed); labelled as mainnet on both networks (§9). */
export function LiveCard() {
  const { data, error } = useMainnetReference(true);
  const live = landingLive(data, error);
  if (live.kind === "hidden") return null;
  return (
    <section aria-labelledby="live-heading" className="card lg:shadow-raised">
      <header className="flex items-center justify-between gap-3">
        <h2 id="live-heading" className="text-sm font-semibold">
          Mezo mainnet today
        </h2>
        <Badge tone="accent" icon={<span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse" />}>
          Live
        </Badge>
      </header>
      {live.kind === "loading" ? (
        <div role="status" aria-busy="true" aria-label="Loading mainnet figures" className="mt-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <dl className="mt-4 divide-y divide-line">
          <Figure label="MUSD/BTC pool value" value={live.poolValue} />
          {live.lpFees && <Figure label="LP, last 30 days" value={live.lpFees} />}
          <Figure label="Stability Pool deposits" value={live.spDeposits} sub={`${live.spShare} of MUSD supply`} />
        </dl>
      )}
      <p className="mt-4 text-xs text-muted">Read from Mezo mainnet. Past results, not a forecast.</p>
    </section>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">
        {value}
        {sub && <span className="block text-xs font-normal text-muted">{sub}</span>}
      </dd>
    </div>
  );
}
