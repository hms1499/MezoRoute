/** Pure SVG geometry for the "If BTC moves" chart (U3 §4.1); `BtcMoveChart` only draws what this returns. */

import { CHART_FONT_PX } from "@/lib/ui/tokens";

export type SeriesId = "lp" | "sp" | "cr" | "lp-before" | "sp-before" | "baseline";
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

/**
 * `scale` (U15): keep `around × (1 ± spread)` in view, so the slope shows how much of the position moves with BTC
 * (a position fully in BTC spans the plot, a MUSD deposit stays flat). It only widens the fitted range.
 */
export type RelativeScale = { around: number; spread: number };

export function chartGeometry(input: { series: Series[]; bands?: Band[]; width: number; height: number; pad?: Pad; scale?: RelativeScale }) {
  const { series, bands = [], width, height, pad = DEFAULT_PAD, scale } = input;
  const top = pad.top;
  const bottom = height - pad.bottom;
  const left = pad.left;
  const right = width - pad.right;

  // Each band's upper edge is kept in view, so the chart always shows where the danger starts.
  const values = [
    ...series.flatMap((s) => s.points.map((p) => p.value)),
    ...bands.map((b) => b.to),
    ...(scale ? [scale.around * (1 - scale.spread), scale.around * (1 + scale.spread)] : []),
  ];
  // With nothing to draw, Math.min/max give ±Infinity and every coordinate turns into NaN.
  let lo = values.length ? Math.min(...values) : 0;
  let hi = values.length ? Math.max(...values) : 0;
  const span = hi - lo || Math.abs(hi) * 0.1 || 1;
  // The relative range is the frame itself; headroom would only push it off centre-weighted symmetry.
  if (!scale) {
    lo -= span * HEADROOM;
    hi += span * HEADROOM;
  } else if (hi === lo) {
    lo -= span / 2;
    hi += span / 2;
  }

  const x = (move: number) => left + ((move - MIN_MOVE) / (MAX_MOVE - MIN_MOVE)) * (right - left);
  const y = (value: number) => bottom - ((value - lo) / (hi - lo)) * (bottom - top);
  const clampY = (v: number) => Math.min(bottom, Math.max(top, v));

  const paths: Record<string, string> = {};
  for (const s of series) {
    // U15: smooth through the real points (monotone, so no invented rise or dip).
    paths[s.id] = smoothPath(s.points.map((p) => ({ x: x(p.move), y: y(p.value) })));
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
    .filter((s) => !s.id.endsWith("-before") && s.id !== "baseline")
    .flatMap((s) =>
      sides.flatMap(([side, move]) => {
        const point = s.points.find((p) => p.move === move);
        return point ? [{ id: s.id, side, move, value: point.value }] : [];
      }),
    );
}

/** A band shows its label only when the 12 px text fits inside it with a pixel to spare on each side. */
export const BAND_LABEL_MIN_HEIGHT = CHART_FONT_PX + 2;

/**
 * Labels sit above their point, except an end lower than today (U15), whose label goes below it; where two would
 * touch at the same move, the lower value goes below its point.
 * Both stay inside the plot, clear of the axis labels underneath (a low −30% value reached them at 360 px).
 */
export function placeLabels(labels: ChartLabel[], y: (value: number) => number, plot: { top: number; bottom: number }): (ChartLabel & { y: number })[] {
  return labels.map((label) => {
    const twin = labels.find((other) => other !== label && other.side === label.side);
    const close = twin !== undefined && Math.abs(y(label.value) - y(twin.value)) < 14;
    // U15: an end lower than today has the line rising away above it, so its label goes below the point.
    const today = labels.find((other) => other.id === label.id && other.side === "today");
    const lowEnd = label.side !== "today" && today !== undefined && label.value < today.value;
    let below = close ? label.value < twin.value || (label.value === twin.value && label.id > twin.id) : lowEnd;
    // With no room on the chosen side the clamp would set the text on the line: use the other side.
    if (!close && !below && y(label.value) - 6 < plot.top + 9) below = true;
    else if (!close && below && y(label.value) + 14 > plot.bottom - 3) below = false;
    const at = below ? y(label.value) + 14 : y(label.value) - 6;
    return { ...label, y: Math.min(plot.bottom - 3, Math.max(plot.top + 9, at)) };
  });
}

export type LabelBox = { left: number; right: number; top: number; bottom: number };
export type PlacedLabel = ChartLabel & { y: number; anchor: "start" | "end" };

/** Geist Mono's advance is 0.6 em, so a label's width follows from its length. */
const LABEL_ADVANCE = 0.6;
/** The label's halo is a 3 px stroke, so the drawn text reaches 1.5 px past its glyphs on every side. */
const LABEL_HALO = 1.5;
/** How far a "Today" label stands off the today line, and an end label off the plot's edge. */
const TODAY_GAP = 4;
const EDGE_GAP = 2;

/** Where a label's text starts (anchor start) or ends (anchor end). */
export function labelX(label: Pick<PlacedLabel, "side" | "anchor">, x: (move: number) => number, plot: { left: number; right: number }): number {
  if (label.side === "left") return plot.left + EDGE_GAP;
  if (label.side === "right") return plot.right - EDGE_GAP;
  return label.anchor === "end" ? x(0) - TODAY_GAP : x(0) + TODAY_GAP;
}

/** The text box of a placed label: `y` is the text's baseline, so the box rises a cap height above it. */
export function labelBox(label: PlacedLabel, x: (move: number) => number, plot: { left: number; right: number }, text: string): LabelBox {
  const width = text.length * CHART_FONT_PX * LABEL_ADVANCE;
  const at = labelX(label, x, plot);
  // The halo counts: it is part of what the eye sees, so a line clears the drawn text, not just its glyphs.
  const left = (label.anchor === "end" ? at - width : at) - LABEL_HALO;
  return {
    left,
    right: left + width + 2 * LABEL_HALO,
    top: label.y - CHART_FONT_PX * 0.8 - LABEL_HALO,
    bottom: label.y + 2 + LABEL_HALO,
  };
}

/** True when the polyline runs through the box (with a 1 px margin, for the stroke). */
export function labelHitsLine(box: LabelBox, points: { x: number; y: number }[]): boolean {
  const m = 1;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const from = Math.max(Math.min(a.x, b.x), box.left - m);
    const to = Math.min(Math.max(a.x, b.x), box.right + m);
    if (from > to) continue;
    const at = (px: number) => (b.x === a.x ? a.y : a.y + ((px - a.x) / (b.x - a.x)) * (b.y - a.y));
    const lo = Math.min(at(from), at(to));
    const hi = Math.max(at(from), at(to));
    if (hi >= box.top - m && lo <= box.bottom + m) return true;
  }
  return false;
}

/**
 * U17 §7: move a label off the lines of its plot, the one it names above all. `placeLabels` picks a side by value alone, and a rising line then ran
 * through the text of its own low end and "Today" labels. For each label that sits on its series' line, the first
 * position that clears it wins: the other side of the today line, the other side of the point, then small steps
 * away. A label that is already clear, or that nothing clears, stays where `placeLabels` put it.
 */
export function clearLabels(
  labels: (ChartLabel & { y: number })[],
  input: {
    x: (move: number) => number;
    y: (value: number) => number;
    plot: { top: number; bottom: number; left: number; right: number };
    series: Series[];
    text: (label: ChartLabel) => string;
  },
): PlacedLabel[] {
  const { x, y, plot } = input;
  const minY = plot.top + CHART_FONT_PX * 0.8;
  const maxY = plot.bottom - 3;
  const taken: LabelBox[] = [];
  const overlaps = (a: LabelBox, b: LabelBox) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  return labels.map((label) => {
    // Its own line first of all, and every other line drawn in the plot (the dashed baseline ran through a label).
    const lines = input.series.map((s) => s.points.map((p) => ({ x: x(p.move), y: y(p.value) })));
    const text = input.text(label);
    const anchor: PlacedLabel["anchor"] = label.side === "right" ? "end" : "start";
    const other: PlacedLabel["anchor"] = anchor === "end" ? "start" : "end";
    const point = y(label.value);
    const mirrored = point + (point - label.y) + CHART_FONT_PX * 0.6; // the same gap on the point's other side
    const anchors = label.side === "today" ? [anchor, other] : [anchor];
    const ys = [label.y, mirrored];
    for (let step = 2; step <= 40; step += 2) ys.push(label.y - step, label.y + step);
    const fits = (candidate: PlacedLabel) => {
      const box = labelBox(candidate, x, plot, text);
      return candidate.y >= minY && candidate.y <= maxY && !lines.some((line) => labelHitsLine(box, line)) && !taken.some((t) => overlaps(box, t));
    };
    let chosen: PlacedLabel = { ...label, anchor };
    search: for (const at of ys) {
      for (const a of anchors) {
        const candidate = { ...label, y: at, anchor: a };
        if (fits(candidate)) {
          chosen = candidate;
          break search;
        }
      }
    }
    taken.push(labelBox(chosen, x, plot, text));
    return chosen;
  });
}

/**
 * U15: an end label with its change from today ("1.89 (−16%)"), so the −30% and +30% ends say what the move does.
 * Today's label, and any label when today is zero, stays the plain value.
 */
export function labelText(label: { side: ChartLabel["side"]; value: number; today: number }, format: (value: number) => string): string {
  const value = format(label.value);
  if (label.side === "today" || label.today === 0) return value;
  const change = Math.round(((label.value - label.today) / label.today) * 100);
  const signed = change > 0 ? `+${change}%` : change < 0 ? `−${Math.abs(change)}%` : "0%";
  return `${value} (${signed})`;
}

/**
 * A smooth curve through every point, monotone between them (the tangent rule of d3's monotoneX): a control point
 * never leaves its segment's range, so the curve can not invent a rise or a dip the figures do not have.
 */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const start = `M${round(points[0].x)} ${round(points[0].y)}`;
  if (points.length === 1) return start;
  const slope = (i: number) => (points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x || 1);
  const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);
  const tangent = (i: number) => {
    if (i === 0) return slope(0);
    if (i === points.length - 1) return slope(i - 1);
    const h0 = points[i].x - points[i - 1].x;
    const h1 = points[i + 1].x - points[i].x;
    const s0 = slope(i - 1);
    const s1 = slope(i);
    const p = (s0 * h1 + s1 * h0) / (h0 + h1 || 1);
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  };
  const t = points.map((_, i) => tangent(i));
  let d = start;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const h = (b.x - a.x) / 3;
    d += ` C${round(a.x + h)} ${round(a.y + t[i] * h)} ${round(b.x - h)} ${round(b.y - t[i + 1] * h)} ${round(b.x)} ${round(b.y)}`;
  }
  return d;
}

export type GapRegion = { tone: "loss" | "gain"; points: { move: number; top: number; bottom: number }[] };

/**
 * Where a line sits below (loss) or above (gain) its reference, as runs of points; the crossing between two points is
 * interpolated, so each run starts and ends on the reference. Both series share the chart's moves.
 */
export function gapRegions(main: Series, reference: Series): GapRegion[] {
  const pairs = main.points.flatMap((p, i) => {
    const ref = reference.points[i];
    return ref && ref.move === p.move ? [{ move: p.move, top: p.value, bottom: ref.value }] : [];
  });
  const diff = (p: { top: number; bottom: number }) => p.top - p.bottom;
  const aug: { move: number; top: number; bottom: number }[] = [];
  pairs.forEach((p, i) => {
    aug.push(p);
    const next = pairs[i + 1];
    if (next && diff(p) * diff(next) < 0) {
      const f = diff(p) / (diff(p) - diff(next));
      const top = p.top + f * (next.top - p.top);
      aug.push({ move: p.move + f * (next.move - p.move), top, bottom: top });
    }
  });
  const regions: GapRegion[] = [];
  let tone: GapRegion["tone"] | null = null;
  let run: GapRegion["points"] = [];
  for (const p of aug) {
    const d = diff(p);
    if (Math.abs(d) < 1e-12) {
      if (tone) regions.push({ tone, points: [...run, p] });
      tone = null;
      run = [p];
      continue;
    }
    tone ??= d < 0 ? "loss" : "gain";
    run.push(p);
  }
  if (tone) regions.push({ tone, points: run });
  return regions;
}

/** The stretches of a line under a threshold (the CR under 160% or 110%), each starting or ending where it crosses. */
export function belowRuns(series: Series, threshold: number): { move: number; value: number }[][] {
  const runs: { move: number; value: number }[][] = [];
  let run: { move: number; value: number }[] | null = null;
  const cross = (a: { move: number; value: number }, b: { move: number; value: number }) => ({
    move: a.move + ((threshold - a.value) / (b.value - a.value)) * (b.move - a.move),
    value: threshold,
  });
  series.points.forEach((p, i) => {
    const prev = series.points[i - 1];
    if (p.value < threshold) {
      if (!run) {
        run = [];
        if (prev) run.push(prev.value === threshold ? prev : cross(prev, p));
      }
      run.push(p);
    } else if (run) {
      run.push(p.value === threshold ? p : cross(prev, p));
      runs.push(run);
      run = null;
    }
  });
  if (run) runs.push(run);
  return runs;
}

/** The BTC move under a pointer at `px`, snapped to the chart's 5% steps and kept inside ±30%. */
export function moveAt(px: number, plot: { left: number; right: number }): number {
  const raw = MIN_MOVE + ((px - plot.left) / (plot.right - plot.left || 1)) * (MAX_MOVE - MIN_MOVE);
  return Math.min(MAX_MOVE, Math.max(MIN_MOVE, Math.round(raw / 5) * 5));
}

export type ReadoutTone = "ink" | "muted" | "positive" | "negative" | "warning" | "danger" | "lp" | "sp";
export type Readout = { lead: string; parts: { text: string; tone: ReadoutTone }[] };

const SERIES_NAME: Partial<Record<SeriesId, string>> = { lp: "LP", sp: "Stability Pool" };

/**
 * The line above a chart that follows the pointer: the BTC move, then what the chart says there. One value line gives
 * its value and change from today (and what it was, on a preview); two give both values; a CR line names its band.
 */
export function readout(input: { series: Series[]; move: number; format: (value: number) => string; unit?: string; bands?: Band[] }): Readout {
  const { series, move, format, unit, bands } = input;
  const at = (s: Series) => s.points.find((p) => p.move === move)?.value ?? 0;
  const lead = move === 0 ? "Today" : `If BTC ${move > 0 ? "+" : "−"}${Math.abs(move)}%`;
  const solid = series.filter((s) => !s.id.endsWith("-before") && s.id !== "baseline");
  const withUnit = (text: string) => (unit ? `${text} ${unit}` : text);

  if (solid.length === 1 && solid[0].id === "cr") {
    const value = at(solid[0]);
    const band = [...(bands ?? [])].sort((a, b) => a.to - b.to).find((b) => value < b.to);
    return { lead, parts: [{ text: `CR ${format(value)}`, tone: band ? band.tone : "ink" }, ...(band ? [{ text: band.label, tone: band.tone }] : [])] };
  }
  if (solid.length !== 1) {
    return { lead, parts: solid.map((s) => ({ text: `${SERIES_NAME[s.id] ?? s.id} ${format(at(s))}`, tone: s.id === "sp" ? "sp" : "lp" })) };
  }
  const main = solid[0];
  const value = at(main);
  const parts: Readout["parts"] = [{ text: withUnit(format(value)), tone: "ink" }];
  // U17: with a baseline the change is measured from it (a deposit preview's baseline is what was put in, so the
  // gap that is already there today is said too); without one, from today's value.
  const baseline = series.find((s) => s.id === "baseline");
  const today = main.points.find((p) => p.move === 0)?.value ?? 0;
  const from = baseline ? at(baseline) : today;
  if (move !== 0 || from !== value) {
    const change = value - from;
    const pct = from === 0 ? 0 : Math.round((change / from) * 100);
    const sign = change > 0 ? "+" : change < 0 ? "−" : "";
    const pctText = pct > 0 ? `+${pct}%` : pct < 0 ? `−${Math.abs(pct)}%` : "0%";
    parts.push({ text: `${sign}${format(Math.abs(change))} (${pctText})`, tone: change > 0 ? "positive" : change < 0 ? "negative" : "muted" });
  }
  const before = series.find((s) => s.id === `${main.id}-before`);
  if (before) parts.push({ text: `was ${format(at(before))}`, tone: "muted" });
  return { lead, parts };
}
