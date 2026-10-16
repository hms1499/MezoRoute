import type { Band, Series } from "@/lib/chart/move-chart";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { formatToken } from "@/lib/format";
import { WAD } from "@/lib/math";
import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";
import { collateralRatio } from "@/lib/trove/health";
import { exposure, type Exposure } from "./exposure";
import { lpMoveFactor, mcrCrossing, MOVES } from "./moves";

const toNumber = (wei: bigint) => Number(wei) / 1e18;
/** A 1e18 ratio as a percent number (1.1e18 → 110). */
const toPercent = (ratio: bigint) => Number(ratio) / 1e16;

/** The exposure sources worth listing; the breakdown shows only when there are two or more (U3 §4.3). */
export function breakdownSources(e: Exposure): ("trove" | "lp" | "sp")[] {
  const sources: ("trove" | "lp" | "sp")[] = [];
  if (e.troveBtc > 0n) sources.push("trove");
  if (e.lpBtc > 0n || e.lpMusd > 0n) sources.push("lp");
  if (e.spDeposit > 0n || e.spBtcGain > 0n) sources.push("sp");
  return sources;
}

/** LP and Stability Pool value lines in MUSD over the chart's moves; null when neither holds anything. */
export function valueSeries(
  input: { lpValue: bigint; spDeposit: bigint; spBtcGain: bigint; price: bigint },
  id: "now" | "before" = "now",
): Series[] | null {
  const suffix = id === "before" ? "-before" : "";
  const series: Series[] = [];
  if (input.lpValue > 0n) {
    series.push({
      id: `lp${suffix}` as Series["id"],
      points: MOVES.map((move) => ({ move, value: toNumber((input.lpValue * lpMoveFactor(move)) / WAD) })),
    });
  }
  if (input.spDeposit > 0n || input.spBtcGain > 0n) {
    series.push({
      id: `sp${suffix}` as Series["id"],
      points: MOVES.map((move) => {
        const price = (input.price * BigInt(100 + move)) / 100n;
        return { move, value: toNumber(input.spDeposit + (input.spBtcGain * price) / WAD) };
      }),
    });
  }
  return series.length > 0 ? series : null;
}

export type CrPlot = { series: Series; bands: Band[]; crossing: { move: number; price: bigint } | null };

/** The exposure section's plots: position value (with the before lines on previews) and the Trove's CR. */
export function chartPlots(input: { snapshot: DashboardSnapshot; before?: DashboardSnapshot }): { value: Series[] | null; cr: CrPlot | null } {
  const { snapshot, before } = input;
  const now = valueSeries(valueInput(snapshot));
  const prior = before ? valueSeries(valueInput(before), "before") : null;
  const value = now || prior ? [...(now ?? []), ...(prior ?? [])] : null;

  const trove = snapshot.trove;
  if (!trove) return { value, cr: null };
  const mcr = toPercent(snapshot.protocol.mcr);
  const points = MOVES.flatMap((move) => {
    const cr = collateralRatio(trove, (snapshot.price * BigInt(100 + move)) / 100n);
    return cr === null ? [] : [{ move, value: toPercent(cr) }];
  });
  if (points.length === 0) return { value, cr: null };
  return {
    value,
    cr: {
      series: { id: "cr", points },
      bands: [
        { from: 0, to: mcr, tone: "danger", label: "Liquidation" },
        { from: mcr, to: toPercent(CR_SAFETY_FLOOR), tone: "warning", label: "Below 160%" },
      ],
      crossing: mcrCrossing(snapshot),
    },
  };
}

/** The CR plot's crossing label; rounded up, like the Trove card's liquidation price, so both read the same. */
export function crossingLabel(liquidationPrice: bigint): string {
  return `Liquidated below ${formatToken(liquidationPrice, 18, 0, "up")}`;
}

function valueInput(snapshot: DashboardSnapshot) {
  const e = exposure(snapshot);
  return { lpValue: e.lpValue, spDeposit: e.spDeposit, spBtcGain: e.spBtcGain, price: snapshot.price };
}
