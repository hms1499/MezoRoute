"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import {
  BAND_LABEL_MIN_HEIGHT,
  belowRuns,
  chartGeometry,
  chartLabels,
  gapRegions,
  labelText,
  moveAt,
  clearLabels,
  labelX,
  placeLabels,
  type ChartLabel,
  readout,
  smoothPath,
  type Band,
  type ReadoutTone,
  type RelativeScale,
  type Series,
  type SeriesId,
} from "@/lib/chart/move-chart";
import { CHART_FONT_PX, themeColor } from "@/lib/ui/tokens";
import { cx } from "@/lib/ui/cx";

export type MovePlot = {
  title: string;
  series: Series[];
  bands?: Band[];
  format: (value: number) => string;
  /** The readout's unit after one line's value ("2.08 MUSD"). */
  unit?: string;
  /** A marked point on the plot, e.g. where the Trove reaches the MCR. */
  crossing?: { move: number; value: number; label: string };
  /** U15: keep today's value × (1 ± spread) in view, so the slope shows how much moves with BTC. */
  scale?: RelativeScale;
  /** U15: the end labels add their change from today ("1.89 (−16%)"). */
  changeLabels?: boolean;
};

// Theme variables (U9), set through `style`: SVG presentation attributes do not reliably resolve var().
const STROKE: Record<SeriesId, string> = {
  lp: themeColor.accent,
  sp: themeColor.sp,
  cr: themeColor.ink,
  "lp-before": themeColor.accent,
  "sp-before": themeColor.sp,
  baseline: themeColor.muted,
};
const BAND_FILL = { danger: themeColor["danger-soft"], warning: themeColor["warning-bg"] };
const BAND_TEXT = { danger: themeColor.danger, warning: themeColor["warning-ink"] };
const BAND_LINE = { danger: themeColor.danger, warning: themeColor["warning-ink"] };
/** Loss is what BTC costs the position (BTC's colour), gain what it pays (the accent); both faint, under the lines. */
const GAP_FILL = { loss: themeColor.btc, gain: themeColor.accent };
const READOUT_TONE: Record<ReadoutTone, string> = {
  ink: "text-ink",
  muted: "text-muted",
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning-ink",
  danger: "text-danger",
  lp: "text-accent",
  sp: "text-sp",
};
const LEGEND_NAME: Partial<Record<SeriesId, string>> = { lp: "LP", sp: "Stability Pool", baseline: "Kept in MUSD" };
const FALLBACK_WIDTH = 320;
/** The readout rests here until the pointer, a tap, or the arrow keys move it. */
const REST_MOVE = -30;

/**
 * The "If BTC moves" chart (U3 §4; U15): smooth value lines from −30% to +30% around today's price, one plot per
 * unit. The gap between a line and its reference ("Kept in MUSD", or the Stability Pool beside the LP) is shaded as a
 * loss or a gain, a readout above each plot follows the pointer, and a CR line is coloured inside its bands. Each plot
 * is a slider (arrow keys, Home, End) whose value text is the readout; `ariaLabel` is the summary, and `children`
 * (the figures table) stays the accessible source.
 */
export function BtcMoveChart({
  plots,
  ariaLabel,
  highlight = null,
  drawIn = false,
  well = false,
  className,
  children,
}: {
  plots: MovePlot[];
  ariaLabel: string;
  highlight?: SeriesId | null;
  /** The landing's one-time line draw (CSS only runs without reduced motion). */
  drawIn?: boolean;
  /** Draw the plots in an inset well (U3 §3.3), for charts inside the app's sections and panels. */
  well?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const height = width < 480 ? 120 : 160;

  return (
    <div ref={ref} className={cx("w-full", className)}>
      <p className="sr-only">{ariaLabel}</p>
      <div className={cx("space-y-4", well && "rounded-inset bg-well p-3")}>
        {plots.map((plot) => (
          <Plot key={plot.title} plot={plot} width={width} height={height} highlight={highlight} drawIn={drawIn} halo={well ? themeColor.well : themeColor.surface} />
        ))}
      </div>
      {children}
    </div>
  );
}

function Plot({
  plot,
  width,
  height,
  highlight,
  drawIn,
  halo,
}: {
  plot: MovePlot;
  width: number;
  height: number;
  highlight: SeriesId | null;
  drawIn: boolean;
  /** The background behind the plot: value labels get an outline in it, so lines crossing them never cut the digits. */
  halo: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const g = chartGeometry({ series: plot.series, bands: plot.bands, width, height, scale: plot.scale });
  const today = g.x(0);
  const todayOf = (id: SeriesId) => plot.series.find((s) => s.id === id)?.points.find((p) => p.move === 0)?.value ?? 0;
  const labelOf = (label: ChartLabel) =>
    plot.changeLabels ? labelText({ side: label.side, value: label.value, today: todayOf(label.id) }, plot.format) : plot.format(label.value);
  // U17: a label never sits on the line it names (a rising line ran through its own low-end and Today labels).
  const labels = clearLabels(placeLabels(chartLabels({ series: plot.series, width }), g.y, g.plot), { x: g.x, y: g.y, plot: g.plot, series: plot.series, text: labelOf });
  const solid = plot.series.filter((s) => !s.id.endsWith("-before") && s.id !== "baseline");
  const hasBefore = plot.series.some((s) => s.id.endsWith("-before"));

  // The gap: the line against Kept in MUSD, or the LP against the Stability Pool.
  const main = solid.find((s) => s.id === "lp") ?? (solid.length === 1 && solid[0].id !== "cr" ? solid[0] : undefined);
  const reference = plot.series.find((s) => s.id === "baseline") ?? (main?.id === "lp" ? solid.find((s) => s.id === "sp") : undefined);
  const regions = main && reference ? gapRegions(main, reference) : [];

  // A CR line in its bands: the stretch under each band's top is drawn again in the band's colour.
  const crSeries = solid.find((s) => s.id === "cr");
  const bandRuns = crSeries
    ? [...(plot.bands ?? [])].sort((a, b) => b.to - a.to).flatMap((band) => belowRuns(crSeries, band.to).map((run) => ({ tone: band.tone, run })))
    : [];

  const move = active ?? REST_MOVE;
  const shown = readout({ series: plot.series, move, format: plot.format, unit: plot.unit, bands: plot.bands });
  const valueText = `${shown.lead}: ${shown.parts.map((p) => p.text).join(", ")}`;

  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    setActive(moveAt(((event.clientX - box.left) / box.width) * width, g.plot));
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 }[event.key];
    if (step !== undefined) setActive(Math.min(30, Math.max(-30, move + step)));
    else if (event.key === "Home") setActive(-30);
    else if (event.key === "End") setActive(30);
    else return;
    event.preventDefault();
  };

  return (
    <figure className="m-0">
      {/* The legend and the crossing's label sit in the caption row: inside the plot they collide with the labels. */}
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-muted">
        <span>{plot.title}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {[...solid.filter((s) => s.id !== "cr" && (solid.length > 1 || reference)), ...(reference?.id === "baseline" ? [reference] : [])].map((s) => (
            <Legend key={s.id} id={s.id} />
          ))}
          {hasBefore && <Legend id="lp-before" label="Before" />}
          {plot.crossing && <span className="font-medium text-danger">{plot.crossing.label}</span>}
        </span>
      </figcaption>
      <p aria-hidden className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
        <span className="text-muted">{shown.lead}</span>
        {shown.parts.map((part) => (
          <span key={part.text} className={READOUT_TONE[part.tone]}>
            {part.text}
          </span>
        ))}
      </p>
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${plot.title}: BTC move`}
        aria-valuemin={-30}
        aria-valuemax={30}
        aria-valuenow={move}
        aria-valuetext={valueText}
        onPointerMove={pointerMove}
        onPointerDown={pointerMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={keyDown}
        onBlur={() => setActive(null)}
        className="mt-1 touch-pan-y rounded-inset outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <svg aria-hidden viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block max-w-full overflow-visible">
          {g.ticks.map((tick) => (
            <line key={tick} x1={g.plot.left} x2={g.plot.right} y1={g.y(tick)} y2={g.y(tick)} strokeWidth={1} style={{ stroke: themeColor.line }} />
          ))}
          {g.bandRects.map((band) => (
            <g key={band.label}>
              <rect x={g.plot.left} y={band.y} width={g.plot.right - g.plot.left} height={Math.max(0, band.height)} style={{ fill: BAND_FILL[band.tone] }} />
              {band.height >= BAND_LABEL_MIN_HEIGHT && (
                <text x={g.plot.right - 4} y={band.y + CHART_FONT_PX} textAnchor="end" fontSize={CHART_FONT_PX} style={{ fill: BAND_TEXT[band.tone] }}>
                  {band.label}
                </text>
              )}
            </g>
          ))}
          {regions.map((region, i) => {
            const top = smoothPath(region.points.map((p) => ({ x: g.x(p.move), y: g.y(p.top) })));
            const back = [...region.points].reverse().map((p) => `L${Math.round(g.x(p.move) * 10) / 10} ${Math.round(g.y(p.bottom) * 10) / 10}`).join(" ");
            return <path key={`${region.tone}-${i}`} data-gap={region.tone} d={`${top} ${back} Z`} fillOpacity={0.14} style={{ fill: GAP_FILL[region.tone] }} />;
          })}
          <line x1={today} x2={today} y1={g.plot.top} y2={g.plot.bottom} strokeWidth={1} strokeDasharray="2 3" style={{ stroke: themeColor.muted }} />
          {plot.series.map((s) => {
            if (s.id === "baseline") {
              return <path key={s.id} d={g.paths[s.id]} fill="none" style={{ stroke: STROKE.baseline }} strokeWidth={1.5} strokeDasharray="3 3" />;
            }
            const before = s.id.endsWith("-before");
            return (
              <path
                key={s.id}
                d={g.paths[s.id]}
                fill="none"
                style={{ stroke: STROKE[s.id] }}
                strokeOpacity={before ? 0.45 : 1}
                strokeDasharray={before ? "4 4" : undefined}
                strokeWidth={highlight === s.id ? 4 : 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={drawIn && !before ? 1 : undefined}
                className={cx(drawIn && !before && "landing-draw", "transition-[stroke-width] duration-fast")}
              />
            );
          })}
          {bandRuns.map(({ tone, run }, i) => (
            <path
              key={`${tone}-${i}`}
              data-band={tone}
              d={smoothPath(run.map((p) => ({ x: g.x(p.move), y: g.y(p.value) })))}
              fill="none"
              style={{ stroke: BAND_LINE[tone] }}
              strokeWidth={3}
              strokeLinecap="round"
            />
          ))}
          {plot.crossing && <circle cx={g.x(plot.crossing.move)} cy={g.y(plot.crossing.value)} r={4} strokeWidth={2} style={{ fill: themeColor.danger, stroke: themeColor.surface }} />}
          {labels.map((label) => (
            <text
              key={`${label.id}-${label.side}`}
              x={labelX(label, g.x, g.plot)}
              y={label.y}
              textAnchor={label.anchor}
              fontSize={CHART_FONT_PX}
              fontFamily="var(--font-geist-mono)"
              style={{ fill: STROKE[label.id], stroke: halo }}
              strokeWidth={3}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {labelOf(label)}
            </text>
          ))}
          {active !== null && (
            <g>
              <line x1={g.x(active)} x2={g.x(active)} y1={g.plot.top} y2={g.plot.bottom} strokeWidth={1} style={{ stroke: themeColor.ink }} />
              {solid.map((s) => {
                const point = s.points.find((p) => p.move === active);
                return point ? <circle key={s.id} cx={g.x(active)} cy={g.y(point.value)} r={5} strokeWidth={2} style={{ fill: STROKE[s.id], stroke: halo }} /> : null;
              })}
            </g>
          )}
          <g fontSize={CHART_FONT_PX} fontFamily="var(--font-geist-mono)" style={{ fill: themeColor.muted }}>
            <text x={g.plot.left} y={height - 4}>
              −30%
            </text>
            <text x={today} y={height - 4} textAnchor="middle">
              Today
            </text>
            <text x={g.plot.right} y={height - 4} textAnchor="end">
              +30%
            </text>
          </g>
        </svg>
      </div>
    </figure>
  );
}

function Legend({ id, label }: { id: SeriesId; label?: string }) {
  const dashed = id === "baseline" || id.endsWith("-before");
  return (
    <span className="inline-flex items-center gap-2">
      <svg aria-hidden width={16} height={2} className="overflow-visible">
        <line
          x1={0}
          x2={16}
          y1={1}
          y2={1}
          strokeWidth={dashed ? 1.5 : 2.5}
          strokeDasharray={dashed ? "3 3" : undefined}
          strokeOpacity={id.endsWith("-before") ? 0.45 : 1}
          style={{ stroke: STROKE[id] }}
        />
      </svg>
      {label ?? LEGEND_NAME[id] ?? id}
    </span>
  );
}
