"use client";

import Link from "next/link";
import type { Address } from "viem";
import { musd } from "@/components/lp/units";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { positionView } from "@/lib/positions/view";
import { StatRow } from "./StatRow";

/** Spec §9 screen 1 "positions summary": shown once there is LP, unclaimed fees, or a Stability Pool deposit. */
export function PositionsSummary({ account, spValue }: { account: Address; spValue: bigint }) {
  const { data } = usePositionsSnapshot(account);
  if (!data) return null;
  const view = positionView(data.snapshot, null);
  if (view.empty && spValue === 0n) return null;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Your positions</h2>
        <Link href="/positions/" className="text-xs font-semibold text-accent hover:underline">
          View positions
        </Link>
      </div>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        {!view.empty && <StatRow label="MUSD/BTC LP (estimated)">{musd(view.lp.value)}</StatRow>}
        {!view.empty && <StatRow label="Unclaimed pool fees (estimated)">{musd(view.fees.total)}</StatRow>}
        {spValue > 0n && <StatRow label="Stability Pool (estimated)">{musd(spValue)}</StatRow>}
      </dl>
    </section>
  );
}
