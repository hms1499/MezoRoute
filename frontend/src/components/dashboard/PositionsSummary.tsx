"use client";

import type { Address } from "viem";
import { musd } from "@/components/lp/units";
import { GAUGE_READ_FAILED_SUMMARY } from "@/lib/gauge/copy";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { positionView } from "@/lib/positions/view";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";

/** Spec §9 screen 1 "positions summary": shown once there is LP, unclaimed fees, or a Stability Pool deposit. */
export function PositionsSummary({ account, spValue }: { account: Address; spValue: bigint }) {
  const { data } = usePositionsSnapshot(account);
  if (!data) return null;
  const view = positionView(data.snapshot, null);
  if (view.empty && spValue === 0n) return null;
  return (
    <Card
      level="section"
      title="Your positions"
      aside={
        <ButtonLink href="/positions/" variant="ghost" size="sm">
          View positions
        </ButtonLink>
      }
    >
      <dl className="mt-3 stat-list">
        {!view.empty && (
          <Stat label="MUSD/BTC LP (estimated)" sub={data.snapshot.gaugeReadFailed ? GAUGE_READ_FAILED_SUMMARY : undefined}>
            {musd(view.lp.value)}
          </Stat>
        )}
        {!view.empty && <Stat label="Unclaimed pool fees (estimated)">{musd(view.fees.total)}</Stat>}
        {spValue > 0n && <Stat label="Stability Pool (estimated)">{musd(spValue)}</Stat>}
      </dl>
    </Card>
  );
}
