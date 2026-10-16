"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { chartGeometry, chartLabels, type Band, type ChartLabel, type Series, type SeriesId } from "@/lib/chart/move-chart";
import { colors } from "@/lib/ui/tokens";
import { cx } from "@/lib/ui/cx";

export type MovePlot = {
  title: string;
  series: Series[];
  bands?: Band[];
  format: (value: number) => string;
  /** A marked point on the plot, e.g. where the Trove reaches the MCR. */
  crossing?: { move: number; value: number; label: string };
};

const STROKE: Record<SeriesId, string> = {
  lp: colors.accent.DEFAULT,
  sp: colors.sp.DEFAULT,
  cr: colors.ink,
  "lp-before": colors.accent.DEFAULT,
  "sp-before": colors.sp.DEFAULT,
};
const BAND_FILL = { danger: colors.danger.soft, warning: colors.warning.bg };
const BAND_TEXT = { danger: colors.danger.DEFAULT, warning: colors.warning.ink };
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
  className,
  children,
}: {
  plots: MovePlot[];
  ariaLabel: string;
  highlight?: SeriesId | null;
  /** The landing's one-time line draw (CSS only runs without reduced motion). */
  drawIn?: boolean;
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
      <div role="img" aria-label={ariaLabel} className="space-y-3">
        {plots.map((plot) => (
          <Plot key={plot.title} plot={plot} width={width} height={height} highlight={highlight} drawIn={drawIn} />
        ))}
      </div>
      {children}
    </div>
  );
}

function Plot({ plot, width, height, highlight, drawIn }: { plot: MovePlot; width: number; height: number; highlight: SeriesId | null; drawIn: boolean }) {
  const g = chartGeometry({ series: plot.series, bands: plot.bands, width, height });
  const labels = placeLabels(chartLabels({ series: plot.series, width }), g.y);
  const today = g.x(0);
  return (
    <figure className="m-0">
      <figcaption className="text-xs text-muted">{plot.title}</figcaption>
      <svg aria-hidden viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="mt-1 block max-w-full overflow-visible">
        {g.ticks.map((tick) => (
          <line key={tick} x1={g.plot.left} x2={g.plot.right} y1={g.y(tick)} y2={g.y(tick)} stroke={colors.line} strokeWidth={1} />
        ))}
        {g.bandRects.map((band) => (
          <g key={band.label}>
            <rect x={g.plot.left} y={band.y} width={g.plot.right - g.plot.left} height={Math.max(0, band.height)} fill={BAND_FILL[band.tone]} />
            {band.height >= 12 && (
              <text x={g.plot.right - 4} y={band.y + 11} textAnchor="end" fontSize={10} fill={BAND_TEXT[band.tone]}>
                {band.label}
              </text>
            )}
          </g>
        ))}
        <line x1={today} x2={today} y1={g.plot.top} y2={g.plot.bottom} stroke={colors.muted} strokeWidth={1} strokeDasharray="2 3" />
        {plot.series.map((s) => {
          const before = s.id.endsWith("-before");
          return (
            <path
              key={s.id}
              d={g.paths[s.id]}
              fill="none"
              stroke={STROKE[s.id]}
              strokeOpacity={before ? 0.45 : 1}
              strokeDasharray={before ? "4 4" : undefined}
              strokeWidth={highlight === s.id ? 4 : 2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cx(drawIn && !before && "landing-draw", "transition-[stroke-width] duration-200")}
            />
          );
        })}
        {plot.crossing && (
          <g>
            <circle cx={g.x(plot.crossing.move)} cy={g.y(plot.crossing.value)} r={4} fill={colors.danger.DEFAULT} />
            <text
              x={g.x(plot.crossing.move) + (plot.crossing.move < 0 ? 8 : -8)}
              y={g.y(plot.crossing.value) - 8}
              textAnchor={plot.crossing.move < 0 ? "start" : "end"}
              fontSize={11}
              fill={colors.danger.DEFAULT}
            >
              {plot.crossing.label}
            </text>
          </g>
        )}
        {labels.map((label) => (
          <text
            key={`${label.id}-${label.side}`}
            x={label.side === "left" ? g.plot.left + 2 : label.side === "right" ? g.plot.right - 2 : today + 4}
            y={label.y}
            textAnchor={label.side === "right" ? "end" : "start"}
            fontSize={11}
            fontFamily="var(--font-mono)"
            fill={STROKE[label.id]}
          >
            {plot.format(label.value)}
          </text>
        ))}
        <g fontSize={10} fontFamily="var(--font-mono)" fill={colors.muted}>
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

/** Labels sit above their point; where two meet at the same move, the lower value goes below its point. */
function placeLabels(labels: ChartLabel[], y: (value: number) => number): (ChartLabel & { y: number })[] {
  return labels.map((label) => {
    const twin = labels.find((other) => other !== label && other.side === label.side);
    const below = twin !== undefined && (label.value < twin.value || (label.value === twin.value && label.id > twin.id));
    return { ...label, y: below ? y(label.value) + 14 : y(label.value) - 6 };
  });
}
