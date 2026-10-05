"use client";

import { ExternalButton } from "@/components/ExternalButton";
import { useNetwork } from "@/lib/config/network-context";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { formatPercent, formatToken } from "@/lib/format";
import { WAD } from "@/lib/math";
import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";
import { collateralRatio, liquidationPrice, type TroveHealth } from "@/lib/trove/health";
import { StatRow } from "./StatRow";

const HEALTH_TAG: Record<TroveHealth, { label: string; tone: string }> = {
  healthy: { label: "Healthy", tone: "bg-accent-soft text-accent" },
  "at-risk": { label: "At risk", tone: "bg-warning-bg text-warning-ink" },
  liquidatable: { label: "Liquidatable", tone: "bg-danger-soft text-danger" },
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
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="font-semibold">Your Trove</h2>
        <p className="mt-2 text-sm text-muted">No open Trove.</p>
        <div className="mt-4">
          <ExternalButton href={network.mezoAppUrl}>Open Mezo app</ExternalButton>
        </div>
      </section>
    );
  }

  const cr = collateralRatio(trove, price);
  const liquidation = liquidationPrice(trove, protocol.mcr);
  const tag = health ? HEALTH_TAG[health] : null;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="flex items-center justify-between font-semibold">
        Your Trove
        {tag && <span className={`rounded-full px-2.5 py-1 text-xs ${tag.tone}`}>{tag.label}</span>}
      </h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="Collateral" sub={`≈ ${formatToken((trove.collateral * price) / WAD, 18, 2)} MUSD`}>
          {formatToken(trove.collateral)} BTC
        </StatRow>
        <StatRow label="Debt" sub={`includes ${formatToken(trove.interest, 18, 2, "up")} MUSD interest`}>
          {formatToken(trove.debt, 18, 2, "up")} MUSD
        </StatRow>
        <StatRow label="Collateral ratio">{cr === null ? "—" : formatPercent(cr)}</StatRow>
        <StatRow label="Liquidation price">
          {liquidation === null ? "—" : `${formatToken(liquidation, 18, 0, "up")} MUSD / BTC`}
        </StatRow>
        <StatRow label="Borrowing room" sub={`keeps CR ≥ ${formatPercent(CR_SAFETY_FLOOR, 0)}`}>
          {formatToken(borrowable, 18, 2)} MUSD
        </StatRow>
      </dl>
    </section>
  );
}
