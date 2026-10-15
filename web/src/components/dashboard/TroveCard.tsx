"use client";

import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useNetwork } from "@/lib/config/network-context";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { formatPercent, formatToken } from "@/lib/format";
import { WAD } from "@/lib/math";
import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";
import { collateralRatio, liquidationPrice, type TroveHealth } from "@/lib/trove/health";
import { Stat } from "@/components/ui/Stat";

const HEALTH_TAG: Record<TroveHealth, { label: string; tone: "accent" | "warning" | "danger" }> = {
  healthy: { label: "Healthy", tone: "accent" },
  "at-risk": { label: "At risk", tone: "warning" },
  liquidatable: { label: "Liquidatable", tone: "danger" },
};

/** Collateral, debt, CR, liquidation price, and borrowing room (FR-03); rounding never flatters the Trove. */
export function TroveCard({
  snapshot,
  borrowable,
  health,
}: {
  snapshot: DashboardSnapshot;
  borrowable: bigint;
  health: TroveHealth | null;
}) {
  const { network } = useNetwork();
  const { trove, price, protocol } = snapshot;

  if (!trove) {
    return (
      <Card title="Your Trove">
        <p className="mt-2 text-sm text-muted">No open Trove.</p>
        <ButtonLink href={network.mezoAppUrl} external variant="secondary" size="sm" className="mt-4">
          Open Mezo app
        </ButtonLink>
      </Card>
    );
  }

  const cr = collateralRatio(trove, price);
  const liquidation = liquidationPrice(trove, protocol.mcr);
  const tag = health ? HEALTH_TAG[health] : null;
  return (
    <Card title="Your Trove" aside={tag && <Badge tone={tag.tone}>{tag.label}</Badge>}>
      <dl className="mt-3 stat-list">
        <Stat label="Collateral" sub={`≈ ${formatToken((trove.collateral * price) / WAD, 18, 2)} MUSD`}>
          {formatToken(trove.collateral)} BTC
        </Stat>
        <Stat label="Debt" sub={`includes ${formatToken(trove.interest, 18, 2, "up")} MUSD interest`}>
          {formatToken(trove.debt, 18, 2, "up")} MUSD
        </Stat>
        <Stat label="Collateral ratio">{cr === null ? "—" : formatPercent(cr)}</Stat>
        <Stat label="Liquidation price">
          {liquidation === null ? "—" : `${formatToken(liquidation, 18, 0, "up")} MUSD / BTC`}
        </Stat>
        <Stat label="Borrowing room" sub={`keeps CR ≥ ${formatPercent(CR_SAFETY_FLOOR, 0)}`}>
          {formatToken(borrowable, 18, 2)} MUSD
        </Stat>
      </dl>
    </Card>
  );
}
