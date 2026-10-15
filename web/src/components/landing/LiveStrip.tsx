"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { explorerAddressUrl, networks } from "@/lib/config/networks";
import { formatToken } from "@/lib/format";
import { compactMusd, type LiveStrip as Strip } from "@/lib/landing/view";
import { useCountUp } from "./hooks";

const executor = networks.mainnet.executor;

/** Mezo mainnet today, in mono: counted up once when the data arrives; absent when the read failed. */
export function LiveStrip({ live }: { live: Strip }) {
  if (live.kind === "hidden") return null;
  return (
    <section aria-label="Mezo mainnet today" className="grid grid-cols-2 border-y border-night-line font-mono sm:grid-cols-4">
      {live.kind === "loading" ? (
        [0, 1, 2, 3].map((key) => (
          <div key={key} role={key === 0 ? "status" : undefined} aria-label={key === 0 ? "Loading mainnet figures" : undefined} className="py-4 pr-4">
            <Skeleton tone="night" className="h-3 w-20" />
            <Skeleton tone="night" className="mt-2 h-6 w-28" />
          </div>
        ))
      ) : (
        <>
          <Item label="pool value">
            <CountFromZero value={live.poolValue} format={(v) => `${formatToken(v, 18, 0)} MUSD`} />
          </Item>
          <Item label="LP fees · 30d" sub={live.lpFees?.sub}>
            {live.lpFees?.value ?? "Unavailable"}
          </Item>
          <Item label="stability pool" sub={`${live.spShare} of MUSD supply`}>
            <CountFromZero value={live.spDeposits} format={compactMusd} />
          </Item>
          <Item label="executor">
            {executor ? (
              <a
                href={explorerAddressUrl(networks.mainnet, executor.address)}
                target="_blank"
                rel="noreferrer"
                className="text-night-lp underline-offset-4 hover:underline"
              >
                verified ✓
              </a>
            ) : (
              "not deployed"
            )}
          </Item>
        </>
      )}
    </section>
  );
}

function Item({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="py-4 pr-4">
      <p className="text-xs text-night-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-night-ink sm:text-xl">{children}</p>
      {sub && <p className="text-xs text-night-muted">{sub}</p>}
    </div>
  );
}

function CountFromZero({ value, format }: { value: bigint; format: (value: bigint) => string }) {
  return <>{format(useCountUp(value, 1_100, 0n))}</>;
}
