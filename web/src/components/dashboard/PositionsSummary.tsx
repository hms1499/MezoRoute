"use client";

import Link from "next/link";
import type { Address } from "viem";
import { musd } from "@/components/lp/units";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { positionView } from "@/lib/positions/view";
import { Stat } from "@/components/ui/Stat";

/** Spec §9 screen 1 "positions summary": shown once there is LP, unclaimed fees, or a Stability Pool deposit. */
export function PositionsSummary({ account, spValue }: { account: Address; spValue: bigint }) {
  const { data } = usePositionsSnapshot(account);
  if (!data) return null;
  const view = positionView(data.snapshot, null);
  if (view.empty && spValue === 0n) return null;
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Your positions</h2>
        <Link href="/positions/" className="text-xs font-semibold text-accent hover:underline">
          View positions
        </Link>
      </div>
      <dl className="mt-3 stat-list">
        {!view.empty && <Stat label="MUSD/BTC LP (estimated)">{musd(view.lp.value)}</Stat>}
        {!view.empty && <Stat label="Unclaimed pool fees (estimated)">{musd(view.fees.total)}</Stat>}
        {spValue > 0n && <Stat label="Stability Pool (estimated)">{musd(spValue)}</Stat>}
      </dl>
    </section>
  );
}
