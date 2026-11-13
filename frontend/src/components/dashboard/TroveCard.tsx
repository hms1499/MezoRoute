"use client";

import type { Address } from "viem";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Term } from "@/components/ui/Term";
import { RiskDot } from "@/components/trove/RiskDot";
import { TroveNotices } from "@/components/trove/TroveNotices";
import { useNetwork } from "@/lib/config/network-context";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { formatPercent, formatToken } from "@/lib/format";
import { useTroveSnapshot } from "@/lib/leverage/useTroveSnapshot";
import { collateralRatio, liquidationPrice } from "@/lib/trove/health";
import { trovePageState } from "@/lib/trove/page";
import { liquidationDrop, liquidationRisk } from "@/lib/trove/risk";

/**
 * U20: the Dashboard's Trove summary, leading to /trove/ (the actions, the queue and the chart live there). It keeps
 * both risk levels, the three figures that decide them, and the notices that need action now.
 */
export function TroveCard({ snapshot, account }: { snapshot: DashboardSnapshot; account?: Address }) {
  const { network } = useNetwork();
  const trove = useTroveSnapshot(account);
  const own = account && trove.data ? trove.data.snapshot : null;
  const { trove: t, price, protocol } = snapshot;
  const title = (
    <>
      Your <Term id="trove">Trove</Term>
    </>
  );

  if (!t) {
    return (
      <Card title={title}>
        <p className="mt-2 text-sm text-muted">No open Trove. MezoRoute can open one with leverage in one transaction.</p>
        {account && own && <TroveNotices account={account} snapshot={own} className="mt-4 space-y-4" />}
        <ButtonLink href="/trove/" variant="secondary" size="md" className="mt-4">
          See Trove
        </ButtonLink>
      </Card>
    );
  }

  const cr = collateralRatio(t, price);
  const liq = liquidationPrice(t, protocol.mcr);
  const state = own ? trovePageState({ snapshot: own, queue: trove.queue, account, network }) : null;
  const redemption = state?.kind === "trove" ? state.summary.redemption : null;
  return (
    <Card title={title}>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className="text-muted">Liquidation</dt>
          <dd>
            <RiskDot level={liquidationRisk(cr, protocol.mcr)} />
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted">Redemption</dt>
          <dd>
            <RiskDot level={typeof redemption === "object" && redemption !== null ? redemption.risk : redemption} />
          </dd>
        </div>
      </dl>
      <dl className="mt-3 stat-list">
        <Stat label={<Term id="collateralRatio">Collateral ratio</Term>}>{cr === null ? "—" : formatPercent(cr)}</Stat>
        <Stat label="Debt" sub={`includes ${formatToken(t.interest, 18, 2, "up")} MUSD interest`}>
          {formatToken(t.debt, 18, 2, "up")} MUSD
        </Stat>
        <Stat label={<Term id="liquidationPrice">Liquidation price</Term>} sub={liq === null ? undefined : `BTC −${liquidationDrop(liq, price)}%`}>
          {liq === null ? "—" : `${formatToken(liq, 18, 0, "up")} MUSD / BTC`}
        </Stat>
      </dl>
      {account && own && <TroveNotices account={account} snapshot={own} className="mt-4 space-y-4" />}
      <ButtonLink href="/trove/" variant="secondary" size="md" className="mt-4">
        Manage Trove
      </ButtonLink>
    </Card>
  );
}
