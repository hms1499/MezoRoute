import { TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Stat } from "@/components/ui/Stat";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { drawdownScenarios, exposure, showsDoubleExposure, type Exposure } from "@/lib/exposure/exposure";
import { formatPercent, formatToken } from "@/lib/format";
import { collateralRatio } from "@/lib/trove/health";

const DOUBLE_EXPOSURE =
  "Borrowing MUSD against BTC and adding it to the MUSD/BTC pool raises your BTC exposure: a BTC drop lowers your collateral ratio and your LP value at the same time.";
const FOOTNOTE =
  "Estimates in MUSD. LP value uses the constant-product approximation (fees ignored). Stability Pool value does not model new liquidations caused by the drop.";

const btc = (value: bigint) => `${formatToken(value)} BTC`;
const musd = (value: bigint) => formatToken(value, 18, 2);
const price = (value: bigint) => formatToken(value, 18, 0);

/**
 * Total BTC exposure and the 10/20/30% drawdown table (FR-15, PRODUCT_SPEC §12). With `before`
 * (route previews) every line reads before → after, replacing F3's separate before/after card.
 */
export function ExposurePanel({ snapshot, before, title = "BTC exposure" }: { snapshot: DashboardSnapshot; before?: DashboardSnapshot; title?: string }) {
  const current = exposure(snapshot);
  const prior = before ? exposure(before) : null;
  const scenarios = drawdownScenarios(snapshot, current);
  const hasTrove = snapshot.trove !== null;
  const hasLp = current.lpBtc > 0n || current.lpMusd > 0n;
  const hasSp = current.spDeposit > 0n || current.spBtcGain > 0n;
  const mcr = snapshot.protocol.mcr;
  const change = (pick: (e: Exposure) => bigint) => (prior ? `${btc(pick(prior))} → ${btc(pick(current))}` : btc(pick(current)));

  if (!hasTrove && !hasLp && !hasSp) {
    return (
      <Card id="exposure" title={title}>
        <p className="mt-2 text-sm text-muted">No BTC exposure in a Trove, the LP, or the Stability Pool yet.</p>
      </Card>
    );
  }

  const nowCr = snapshot.trove ? collateralRatio(snapshot.trove, snapshot.price) : null;
  const rows = [
    { label: "Now", price: snapshot.price, cr: nowCr, liquidatable: nowCr !== null && nowCr < mcr, lpValue: current.lpValue, spValue: current.spValue },
    ...scenarios.map((s) => ({
      label: `−${s.dropPercent}%`,
      price: s.price,
      cr: s.collateralRatio,
      liquidatable: s.liquidatable,
      lpValue: s.lpValue,
      spValue: s.spValue,
    })),
  ];
  return (
    <Card id="exposure" title={title} aside={<span className="text-xs text-muted">BTC {price(snapshot.price)} MUSD</span>}>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-btc [overflow-wrap:anywhere]">{change((e) => e.totalBtc)}</p>
      <p className="text-xs text-muted">Total BTC exposure</p>
      <dl className="stat-list mt-4">
        {hasTrove && <Stat label="Trove collateral">{change((e) => e.troveBtc)}</Stat>}
        {hasLp && (
          <Stat label="MUSD/BTC pool (your share)" sub={`+ ${musd(current.lpMusd)} MUSD · ≈ ${musd(current.lpValue)} MUSD`}>
            {change((e) => e.lpBtc)}
          </Stat>
        )}
        {hasSp && (
          <Stat label="Stability Pool BTC gain" sub={`deposit ${musd(current.spDeposit)} MUSD`}>
            {change((e) => e.spBtcGain)}
          </Stat>
        )}
      </dl>
      {showsDoubleExposure(current) && <Notice className="mt-4">{DOUBLE_EXPOSURE}</Notice>}
      <div className="mt-4 overflow-x-auto">
        {/* One row per drop and one column per figure, so the table fits the dashboard's side column. */}
        <table className="w-full text-xs">
          <caption className="sr-only">Values if the BTC price drops</caption>
          <thead>
            <tr className="border-b border-line text-muted">
              <th scope="col" className="py-2 pr-2 text-left font-medium">
                BTC drop
              </th>
              <th scope="col" className="px-1.5 py-2 text-right font-medium">
                BTC price
              </th>
              {hasTrove && (
                <th scope="col" className="px-1.5 py-2 text-right font-medium">
                  Trove CR
                </th>
              )}
              {hasLp && (
                <th scope="col" className="px-1.5 py-2 text-right font-medium">
                  LP value
                </th>
              )}
              {hasSp && (
                <th scope="col" className="py-2 pl-1.5 text-right font-medium">
                  SP value
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-line/60 last:border-0">
                <th scope="row" className="py-2 pr-2 text-left font-normal text-muted">
                  {row.label}
                </th>
                <td className="px-1.5 py-2 text-right">{price(row.price)}</td>
                {hasTrove && <CrCell cr={row.cr} liquidatable={row.liquidatable} />}
                {hasLp && <td className="px-1.5 py-2 text-right">{musd(row.lpValue)}</td>}
                {hasSp && <td className="py-2 pl-1.5 text-right">{musd(row.spValue)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.some((row) => row.liquidatable) && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-danger">
          <TriangleAlert aria-hidden className="h-3.5 w-3.5 shrink-0" />
          Liquidatable: below the {formatPercent(mcr, 0)} minimum collateral ratio
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted">{FOOTNOTE}</p>
    </Card>
  );
}

function CrCell({ cr, liquidatable }: { cr: bigint | null; liquidatable: boolean }) {
  if (cr === null) return <td className="px-1.5 py-2 text-right">—</td>;
  return (
    <td className={liquidatable ? "bg-danger-soft px-1.5 py-2 text-right font-semibold text-danger" : "px-1.5 py-2 text-right"}>
      <span className="inline-flex items-center gap-1">
        {liquidatable && <TriangleAlert aria-hidden className="h-3 w-3 shrink-0" />}
        {formatPercent(cr)}
      </span>
      {liquidatable && <span className="sr-only"> (liquidatable)</span>}
    </td>
  );
}
