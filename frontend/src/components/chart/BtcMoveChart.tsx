"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BAND_LABEL_MIN_HEIGHT, chartGeometry, chartLabels, placeLabels, type Band, type Series, type SeriesId } from "@/lib/chart/move-chart";
import { CHART_FONT_PX, themeColor } from "@/lib/ui/tokens";
import { cx } from "@/lib/ui/cx";

export type MovePlot = {
  title: string;
  series: Series[];
  bands?: Band[];
  format: (value: number) => string;
  /** A marked point on the plot, e.g. where the Trove reaches the MCR. */
  crossing?: { move: number; value: number; label: string };
};

// Theme variables (U9), set through `style`: SVG presentation attributes do not reliably resolve var().
const STROKE: Record<SeriesId, string> = {
  lp: themeColor.accent,
  sp: themeColor.sp,
  cr: themeColor.ink,
  "lp-before": themeColor.accent,
  "sp-before": themeColor.sp,
};
const BAND_FILL = { danger: themeColor["danger-soft"], warning: themeColor["warning-bg"] };
const BAND_TEXT = { danger: themeColor.danger, warning: themeColor["warning-ink"] };
const FALLBACK_WIDTH = 320;

/**
 * The "If BTC moves" chart (U3 §4): value lines from −30% to +30% around today's price, one plot per
 * unit. Sighted users read the lines; screen readers get `ariaLabel`, and `children` (the figures table)
 * stays the accessible source.
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
      <div role="img" aria-label={ariaLabel} className={cx("space-y-3", well && "rounded-xl bg-well p-3")}>
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
  const g = chartGeometry({ series: plot.series, bands: plot.bands, width, height });
  const labels = placeLabels(chartLabels({ series: plot.series, width }), g.y, g.plot);
  const today = g.x(0);
  return (
    <figure className="m-0">
      {/* The crossing's label sits in the caption row: inside the plot it collides with the Today labels. */}
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted">
        <span>{plot.title}</span>
        {plot.crossing && <span className="font-medium text-danger">{plot.crossing.label}</span>}
      </figcaption>
      <svg aria-hidden viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="mt-1 block max-w-full overflow-visible">
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
        <line x1={today} x2={today} y1={g.plot.top} y2={g.plot.bottom} strokeWidth={1} strokeDasharray="2 3" style={{ stroke: themeColor.muted }} />
        {plot.series.map((s) => {
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
        {plot.crossing && <circle cx={g.x(plot.crossing.move)} cy={g.y(plot.crossing.value)} r={4} strokeWidth={2} style={{ fill: themeColor.danger, stroke: themeColor.surface }} />}
        {labels.map((label) => (
          <text
            key={`${label.id}-${label.side}`}
            x={label.side === "left" ? g.plot.left + 2 : label.side === "right" ? g.plot.right - 2 : today + 4}
            y={label.y}
            textAnchor={label.side === "right" ? "end" : "start"}
            fontSize={CHART_FONT_PX}
            fontFamily="var(--font-mono)"
            style={{ fill: STROKE[label.id], stroke: halo }}
            strokeWidth={3}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {plot.format(label.value)}
          </text>
        ))}
        <g fontSize={CHART_FONT_PX} fontFamily="var(--font-mono)" style={{ fill: themeColor.muted }}>
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
    </figure>
  );
}
