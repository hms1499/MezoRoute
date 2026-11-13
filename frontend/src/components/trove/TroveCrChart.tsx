"use client";

import { BtcMoveChart, type MovePlot } from "@/components/chart/BtcMoveChart";
import { Card } from "@/components/ui/Card";
import { tableClass, thClass } from "@/components/ui/DataTable";
import { crossingLabel } from "@/lib/exposure/plots";
import { formatPercent, formatToken } from "@/lib/format";
import type { TroveSnapshot } from "@/lib/leverage/snapshot";
import { troveCrPlot } from "@/lib/trove/page";
import { liquidationRisk } from "@/lib/trove/risk";
import { cx } from "@/lib/ui/cx";
import { RiskDot } from "./RiskDot";

const chartPercent = (value: number) => `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
const toRatio = (percent: number) => (BigInt(Math.round(percent * 1000)) * 10n ** 18n) / 100_000n;

/** U20 §4: the Trove's collateral ratio as BTC moves ±30%, with the risk levels as bands; the table is the accessible source. */
export function TroveCrChart({ snapshot }: { snapshot: TroveSnapshot }) {
  const plot = troveCrPlot(snapshot);
  if (!plot) return null;
  const { mcr, price } = snapshot.market;
  const chart: MovePlot = {
    title: "Trove collateral ratio",
    series: [plot.series],
    bands: plot.bands,
    format: chartPercent,
    crossing: plot.crossing ? { move: plot.crossing.move, value: Number(mcr) / 1e16, label: crossingLabel(plot.crossing.price) } : undefined,
  };
  const worst = plot.series.points[0];
  const worstRisk = liquidationRisk(toRatio(worst.value), mcr);
  return (
    <Card id="exposure" title="If BTC moves" aside={<span className="text-xs text-muted">BTC price {formatToken(price, 18, 0)} MUSD</span>}>
      <p className="mt-1 text-sm text-muted">Your collateral ratio at BTC −30% to +30%, with the risk levels behind it.</p>
      <BtcMoveChart
        well
        plots={[chart]}
        ariaLabel={`Chart of your Trove's collateral ratio if BTC moves 30% either way. If BTC falls 30%, the ratio is ${chartPercent(worst.value)}.`}
        className="mt-4"
      >
        <details className="mt-3 text-sm">
          <summary className="inline-flex min-h-9 cursor-pointer items-center rounded-full font-medium text-accent hover:underline">Show figures</summary>
          <div className="mt-2 overflow-x-auto">
            <table className={tableClass(true)}>
              <caption className="sr-only">Collateral ratio if the BTC price moves</caption>
              <thead>
                <tr>
                  <th scope="col" className={cx(thClass("left", true), "pr-2")}>
                    BTC move
                  </th>
                  <th scope="col" className={cx(thClass("right", true), "px-2")}>
                    BTC price
                  </th>
                  <th scope="col" className={cx(thClass("right", true), "px-2")}>
                    Collateral ratio
                  </th>
                  <th scope="col" className={cx(thClass("right", true), "pl-2")}>
                    Liquidation risk
                  </th>
                </tr>
              </thead>
              <tbody>
                {plot.series.points.map((point) => (
                  <tr key={point.move} className="border-b border-line/60 last:border-0">
                    <th scope="row" className="py-2 pr-2 text-left font-normal text-muted">
                      {point.move === 0 ? "Now" : `${point.move > 0 ? "+" : "−"}${Math.abs(point.move)}%`}
                    </th>
                    <td className="px-2 py-2 text-right">{formatToken((price * BigInt(100 + point.move)) / 100n, 18, 0)}</td>
                    <td className="px-2 py-2 text-right">{chartPercent(point.value)}</td>
                    <td className="py-2 pl-2 text-right">
                      <RiskDot level={liquidationRisk(toRatio(point.value), mcr)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </BtcMoveChart>
      {worstRisk !== "low" && worstRisk !== null && (
        <p className="mt-2 text-xs text-muted">
          At −30% the liquidation risk is {worstRisk === "liquidatable" ? `liquidatable, below ${formatPercent(mcr, 0)}` : worstRisk === "high" ? "High" : "Medium"}.
        </p>
      )}
    </Card>
  );
}
