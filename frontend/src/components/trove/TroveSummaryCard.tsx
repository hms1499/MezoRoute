"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { Term } from "@/components/ui/Term";
import { formatPercent, formatToken } from "@/lib/format";
import type { TroveSnapshot } from "@/lib/leverage/snapshot";
import type { TroveSummary } from "@/lib/trove/page";
import { riskLines } from "@/lib/trove/risk";
import type { TroveView } from "@/lib/trove/view-pref";
import { RiskDot } from "./RiskDot";

const musd = (v: bigint) => formatToken(v, 18, 2);
const btc = (v: bigint) => formatToken(v, 18, 6);
const wholeUp = (ratio: bigint) => `${formatToken(ratio * 100n, 18, 0, "up")}%`;

/**
 * U20 §4: the Trove at a glance, after Liquity V2's loan card. Loan leads with the debt, Multiply with the net value
 * and leverage; both views show the two risk levels and the same four facts, from one snapshot.
 */
export function TroveSummaryCard({
  snapshot,
  summary,
  view,
  onView,
  onRefresh,
}: {
  snapshot: TroveSnapshot;
  summary: TroveSummary;
  view: TroveView;
  onView: (view: TroveView) => void;
  onRefresh: () => void;
}) {
  const t = snapshot.trove!;
  const { price, mcr } = snapshot.market;
  const lines = riskLines(mcr);
  const rate = formatPercent(t.interestRateBps * 10n ** 14n, 0);
  const crCell: Cell = {
    label: <Term id="collateralRatio">Collateral ratio</Term>,
    value: summary.cr === null ? "—" : formatPercent(summary.cr),
    note: view === "loan" ? `liquidated below ${formatPercent(mcr, 0)} · Mezo suggests 150% or more` : "Mezo suggests 150% or more",
  };
  const liqCell: Cell = {
    label: <Term id="liquidationPrice">Liquidation price</Term>,
    value: summary.liquidationPrice === null ? "—" : `${formatToken(summary.liquidationPrice, 18, 0, "up")} MUSD`,
    note: (
      <>
        {summary.drop !== null && <span className="block">BTC would have to fall {summary.drop}%</span>}
        {view === "loan" && summary.drift !== null && <span className="block">rises ≈ {formatToken(summary.drift, 18, 0, "up")} a year from interest</span>}
      </>
    ),
  };
  const cells: Cell[] =
    view === "loan"
      ? [
          { label: "Collateral", value: `${btc(t.coll)} BTC`, note: `≈ ${musd(summary.collValue)} MUSD` },
          crCell,
          liqCell,
          { label: "Borrowing room", value: `${musd(summary.borrowable)} MUSD`, note: "keeps CR ≥ 160%" },
        ]
      : [
          {
            label: "BTC exposure",
            value: `${btc(t.coll)} BTC`,
            note: summary.multiply.leverage === null ? undefined : `${formatToken(summary.multiply.leverage, 18, 1)}× your net value`,
          },
          { label: "Debt", value: `${musd(t.debt)} MUSD`, note: `${rate} a year` },
          liqCell,
          crCell,
        ];
  const headline =
    view === "loan"
      ? { label: "Total debt", value: `${musd(t.debt)} MUSD`, note: `includes ${formatToken(t.interest, 18, 2, "up")} MUSD interest · ${rate} a year` }
      : {
          label: "Net value",
          value: summary.multiply.netValue > 0n ? `${btc(summary.multiply.netBtc)} BTC` : "—",
          note: summary.multiply.netValue > 0n ? `≈ ${musd(summary.multiply.netValue)} MUSD · collateral minus debt` : "collateral minus debt",
        };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted">{headline.label}</p>
          <p className="text-figure [overflow-wrap:anywhere]">{headline.value}</p>
          <p className="text-xs text-muted">{headline.note}</p>
        </div>
        <Segmented
          label="Trove view"
          size="sm"
          options={[
            { value: "loan", label: "Loan" },
            { value: "multiply", label: "Multiply" },
          ]}
          value={view}
          onChange={onView}
        />
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className="text-muted">
            <Term id="liquidationRisk">Liquidation risk</Term>
          </dt>
          <dd>
            <RiskDot level={summary.liquidationRisk} />
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted">
            <Term id="redemptionRisk">Redemption risk</Term>
          </dt>
          <dd>
            <RiskDot level={typeof summary.redemption === "object" ? summary.redemption.risk : summary.redemption} />
          </dd>
        </div>
      </dl>
      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 md:grid-cols-4 md:gap-0 md:divide-x md:divide-line">
        {cells.map((cell, index) => (
          <div key={index} className="min-w-0 md:px-4 md:first:pl-0 md:last:pr-0">
            <dt className="text-xs text-muted">{cell.label}</dt>
            <dd className="mt-1">
              <span className="block break-words text-xl font-medium">{cell.value}</span>
              {cell.note && <span className="mt-0.5 block text-xs text-muted">{cell.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-line pt-4 text-xs text-muted">
        <p>
          BTC {formatToken(price, 18, 2)} MUSD from Mezo&apos;s oracle · block {snapshot.block.number.toLocaleString("en-US")} ·{" "}
          <button type="button" onClick={onRefresh} className="hit rounded-tip font-medium text-accent underline underline-offset-2 hover:text-accent-hover">
            Refresh
          </button>
        </p>
        <p>
          Liquidation risk: Low from {wholeUp(lines.medium)} · Medium from {wholeUp(lines.high)} · High below
        </p>
      </div>
    </Card>
  );
}

type Cell = { label: ReactNode; value: string; note?: ReactNode };
