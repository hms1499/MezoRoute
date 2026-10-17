"use client";

import { BadgeCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { explorerAddressUrl, networks } from "@/lib/config/networks";
import { formatToken } from "@/lib/format";
import { compactMusd, type LiveStrip as Strip } from "@/lib/landing/view";
import { cx } from "@/lib/ui/cx";
import { useCountUp } from "./hooks";
import { LANDING_MOTION_MS } from "@/lib/ui/motion";

const executor = networks.mainnet.executor;

/** Mezo mainnet today, in mono: counted up once when the data arrives; absent when the read failed. */
export function LiveStrip({ live }: { live: Strip }) {
  if (live.kind === "hidden") return null;
  return (
    <section aria-labelledby="strip-caption" className="landing-divider">
      <p id="strip-caption" className="pt-5 text-xs text-muted">
        {live.kind === "data" ? live.caption : "Live from Mezo mainnet."}
      </p>
      <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4 sm:gap-x-6">
        {live.kind === "loading" ? (
          [0, 1, 2, 3].map((key) => (
            <div key={key} role={key === 0 ? "status" : undefined} aria-label={key === 0 ? "Loading mainnet figures" : undefined} className="py-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-6 w-28" />
            </div>
          ))
        ) : (
          <>
            <Item label="Pool value">
              <CountFromZero value={live.poolValue} format={(v) => `${formatToken(v, 18, 0)} MUSD`} />
            </Item>
            <Item label="LP fees, last 30 days" sub={live.lpFees?.sub}>
              {live.lpFees?.value ?? "Unavailable"}
            </Item>
            <Item label="Stability Pool" sub={`${live.spShare} of MUSD supply`}>
              <CountFromZero value={live.spDeposits} format={compactMusd} />
            </Item>
            <Item label="Executor" sub={executor ? "Source on the Mezo explorer" : undefined} prose>
              {executor ? (
                <a
                  href={explorerAddressUrl(networks.mainnet, executor.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-night-lp underline-offset-4 hover:underline"
                >
                  <BadgeCheck aria-hidden className="h-5 w-5" />
                  Verified
                </a>
              ) : (
                "not deployed"
              )}
            </Item>
          </>
        )}
      </div>
    </section>
  );
}

/** One figure; `prose` sets a word (the Executor link) in the sans face, since mono is for figures only. */
function Item({ label, sub, prose = false, children }: { label: string; sub?: string; prose?: boolean; children: ReactNode }) {
  return (
    <div className="min-w-0 py-5">
      <p className="text-xs text-night-muted">{label}</p>
      <p className={cx("mt-1 text-lg font-medium text-night-ink sm:text-xl", !prose && "font-mono")}>{children}</p>
      {sub && <p className="text-xs text-night-muted">{sub}</p>}
    </div>
  );
}

function CountFromZero({ value, format }: { value: bigint; format: (value: bigint) => string }) {
  return <>{format(useCountUp(value, LANDING_MOTION_MS.liveCount, 0n))}</>;
}
