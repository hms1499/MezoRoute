"use client";

import type { ReactNode } from "react";
import { Settle } from "@/components/ui/Settle";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatToken } from "@/lib/format";
import { compactMusd, type LiveStrip } from "@/lib/landing/view";
import { LANDING_MOTION_MS } from "@/lib/ui/motion";
import { useCountUp } from "./hooks";

/** Mezo mainnet today under the hero's calls to action (U10, from the U2 Live strip); absent when the read failed. */
export function HeroFigures({ live }: { live: LiveStrip }) {
  if (live.kind === "hidden") return null;
  if (live.kind === "loading") {
    return (
      <div className="grid grid-cols-1 gap-6 sm:flex sm:gap-12">
        {[0, 1].map((key) => (
          <div key={key} role={key === 0 ? "status" : undefined} aria-label={key === 0 ? "Loading mainnet figures" : undefined}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-32" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <dl className="grid grid-cols-1 gap-6 sm:flex sm:gap-12">
      <Figure index={0} label="MUSD/BTC pool" sub={live.lpFees ? `${live.lpFees.value} LP fees, last 30 days · ${live.lpFees.sub}` : undefined}>
        <CountFromZero value={live.poolValue} format={(v) => `${formatToken(v, 18, 0)} MUSD`} />
      </Figure>
      <Figure index={1} label="Stability Pool" sub={`${live.spShare} of MUSD supply`}>
        <CountFromZero value={live.spDeposits} format={compactMusd} />
      </Figure>
    </dl>
  );
}

function Figure({ index, label, sub, children }: { index: number; label: string; sub?: string; children: ReactNode }) {
  return (
    <Settle index={index} className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="figure mt-1 whitespace-nowrap text-ink">{children}</dd>
      {sub && <dd className="mt-1 text-xs text-muted">{sub}</dd>}
    </Settle>
  );
}

function CountFromZero({ value, format }: { value: bigint; format: (value: bigint) => string }) {
  return <>{format(useCountUp(value, LANDING_MOTION_MS.liveCount, 0n))}</>;
}
