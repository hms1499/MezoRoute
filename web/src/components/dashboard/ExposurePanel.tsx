import type { ReactNode } from "react";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { drawdownScenarios, exposure } from "@/lib/exposure/exposure";
import { formatPercent, formatToken } from "@/lib/format";
import { collateralRatio } from "@/lib/trove/health";
import { StatRow } from "./StatRow";

const DOUBLE_EXPOSURE =
  "Borrowing MUSD against BTC and adding it to the MUSD/BTC pool raises your BTC exposure: a BTC drop lowers your collateral ratio and your LP value at the same time.";
const FOOTNOTE =
  "Estimates in MUSD. LP value uses the constant-product approximation (fees ignored). Stability Pool value does not model new liquidations caused by the drop.";

const btc = (value: bigint) => `${formatToken(value)} BTC`;
const musd = (value: bigint) => formatToken(value, 18, 2);
const price = (value: bigint) => formatToken(value, 18, 0);

/** Total BTC exposure and the 10/20/30% drawdown table (FR-15, PRODUCT_SPEC §12). */
export function ExposurePanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const current = exposure(snapshot);
  const scenarios = drawdownScenarios(snapshot, current);
  const hasTrove = snapshot.trove !== null;
  const hasLp = current.lpBtc > 0n || current.lpMusd > 0n;
  const hasSp = current.spDeposit > 0n || current.spBtcGain > 0n;
  const mcr = snapshot.protocol.mcr;

  if (!hasTrove && !hasLp && !hasSp) {
    return (
      <section id="exposure" className="scroll-mt-4 rounded-2xl bg-white p-5 shadow-card">
        <h2 className="font-semibold">BTC exposure</h2>
        <p className="mt-2 text-sm text-muted">No BTC exposure in a Trove, the LP, or the Stability Pool yet.</p>
      </section>
    );
  }

  const nowCr = snapshot.trove ? collateralRatio(snapshot.trove, snapshot.price) : null;
  return (
    <section id="exposure" className="scroll-mt-4 rounded-2xl bg-white p-5 shadow-card">
      <h2 className="flex items-baseline justify-between gap-3 font-semibold">
        BTC exposure
        <span className="text-xs font-normal text-muted">BTC {price(snapshot.price)} MUSD</span>
      </h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        {hasTrove && <StatRow label="Trove collateral">{btc(current.troveBtc)}</StatRow>}
        {hasLp && (
          <StatRow
            label="MUSD/BTC pool (your share)"
            sub={`+ ${musd(current.lpMusd)} MUSD · ≈ ${musd(current.lpValue)} MUSD`}
          >
            {btc(current.lpBtc)}
          </StatRow>
        )}
        {hasSp && (
          <StatRow label="Stability Pool BTC gain" sub={`deposit ${musd(current.spDeposit)} MUSD`}>
            {btc(current.spBtcGain)}
          </StatRow>
        )}
        <StatRow label="Total BTC exposure" strong>
          {btc(current.totalBtc)}
        </StatRow>
      </dl>
      <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">{DOUBLE_EXPOSURE}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="py-1.5 pr-2 text-left font-medium">If BTC drops</th>
              <th className="px-1.5 py-1.5 text-right font-medium">Now</th>
              {scenarios.map((s) => (
                <th key={s.dropPercent} className="px-1.5 py-1.5 text-right font-medium">
                  −{s.dropPercent}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="BTC price" now={price(snapshot.price)} cells={scenarios.map((s) => price(s.price))} />
            {hasTrove && (
              <tr className="border-b border-line/60">
                <td className="py-1.5 pr-2">Trove CR</td>
                <CrCell cr={nowCr} liquidatable={nowCr !== null && nowCr < mcr} />
                {scenarios.map((s) => (
                  <CrCell key={s.dropPercent} cr={s.collateralRatio} liquidatable={s.liquidatable} />
                ))}
              </tr>
            )}
            {hasLp && <Row label="LP value" now={musd(current.lpValue)} cells={scenarios.map((s) => musd(s.lpValue))} />}
            {hasSp && (
              <Row label="Stability Pool value" now={musd(current.spValue)} cells={scenarios.map((s) => musd(s.spValue))} />
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted">{FOOTNOTE}</p>
    </section>
  );
}

function Row({ label, now, cells }: { label: string; now: ReactNode; cells: ReactNode[] }) {
  return (
    <tr className="border-b border-line/60">
      <td className="py-1.5 pr-2">{label}</td>
      <td className="px-1.5 py-1.5 text-right">{now}</td>
      {cells.map((cell, index) => (
        <td key={index} className="px-1.5 py-1.5 text-right">
          {cell}
        </td>
      ))}
    </tr>
  );
}

function CrCell({ cr, liquidatable }: { cr: bigint | null; liquidatable: boolean }) {
  if (cr === null) return <td className="px-1.5 py-1.5 text-right">—</td>;
  return (
    <td
      className={
        liquidatable
          ? "rounded-md bg-danger-soft px-1.5 py-1.5 text-right font-semibold text-danger"
          : "px-1.5 py-1.5 text-right"
      }
    >
      {formatPercent(cr)}
      {liquidatable && <span className="block text-[10px]">Liquidatable</span>}
    </td>
  );
}
