/** Pure SVG geometry for the "If BTC moves" chart (U3 §4.1); `BtcMoveChart` only draws what this returns. */

export type SeriesId = "lp" | "sp" | "cr" | "lp-before" | "sp-before";
export type Series = { id: SeriesId; points: { move: number; value: number }[] };
export type Band = { from: number; to: number; tone: "danger" | "warning"; label: string };
export type Pad = { top: number; right: number; bottom: number; left: number };

export const DEFAULT_PAD: Pad = { top: 14, right: 12, bottom: 22, left: 12 };

const MIN_MOVE = -30;
const MAX_MOVE = 30;
/** Space above and below the data, as a share of its range. */
const HEADROOM = 0.08;
/** Below this width the +30% end labels would collide with the "Today" ones. */
const RIGHT_LABEL_MIN_WIDTH = 400;

const round = (n: number) => Math.round(n * 10) / 10;

export function chartGeometry(input: { series: Series[]; bands?: Band[]; width: number; height: number; pad?: Pad }) {
  const { series, bands = [], width, height, pad = DEFAULT_PAD } = input;
  const top = pad.top;
  const bottom = height - pad.bottom;
  const left = pad.left;
  const right = width - pad.right;

  // Each band's upper edge is kept in view, so the chart always shows where the danger starts.
  const values = [...series.flatMap((s) => s.points.map((p) => p.value)), ...bands.map((b) => b.to)];
  // With nothing to draw, Math.min/max give ±Infinity and every coordinate turns into NaN.
  let lo = values.length ? Math.min(...values) : 0;
  let hi = values.length ? Math.max(...values) : 0;
  const span = hi - lo || Math.abs(hi) * 0.1 || 1;
  lo -= span * HEADROOM;
  hi += span * HEADROOM;

  const x = (move: number) => left + ((move - MIN_MOVE) / (MAX_MOVE - MIN_MOVE)) * (right - left);
  const y = (value: number) => bottom - ((value - lo) / (hi - lo)) * (bottom - top);
  const clampY = (v: number) => Math.min(bottom, Math.max(top, v));

  const paths: Record<string, string> = {};
  for (const s of series) {
    paths[s.id] = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${round(x(p.move))} ${round(y(p.value))}`).join(" ");
  }

  const bandRects = bands.map((band) => {
    const yTop = clampY(y(band.to));
    const yBottom = clampY(y(band.from));
    return { y: yTop, height: yBottom - yTop, tone: band.tone, label: band.label };
  });

  return { x, y, paths, ticks: [lo, (lo + hi) / 2, hi], bandRects, plot: { top, bottom, left, right } };
}

export type ChartLabel = { id: SeriesId; side: "left" | "today" | "right"; move: number; value: number };

/** End and "Today" labels for each solid series; the +30% end is dropped on narrow charts. */
export function chartLabels(input: { series: Series[]; width: number }): ChartLabel[] {
  const sides: [ChartLabel["side"], number][] = [
    ["left", MIN_MOVE],
    ["today", 0],
    ...(input.width >= RIGHT_LABEL_MIN_WIDTH ? ([["right", MAX_MOVE]] as [ChartLabel["side"], number][]) : []),
  ];
  return input.series
    .filter((s) => !s.id.endsWith("-before"))
    .flatMap((s) =>
      sides.flatMap(([side, move]) => {
        const point = s.points.find((p) => p.move === move);
        return point ? [{ id: s.id, side, move, value: point.value }] : [];
      }),
    );
}
