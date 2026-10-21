import { routeMotif } from "@/lib/landing/route-motif";
import { cx } from "@/lib/ui/cx";
import { CHART_FONT_PX, themeColor } from "@/lib/ui/tokens";

// Two boxes: the desktop column, and a wide short band under the copy below 1024 px (spec §5).
const BOXES = { wide: { width: 600, height: 520 }, band: { width: 400, height: 220 } } as const;

/**
 * MezoRoute's motif (U10 hero): MUSD lines converge into the MezoRoute node and split into the LP lane (accent) and
 * the Stability Pool lane (sp). Decorative. Lines draw in once; dots travel along them only without reduced motion.
 */
export function RouteMotif({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className}>
      <Motif box="wide" className="hidden lg:block" />
      <Motif box="band" className="lg:hidden" />
    </div>
  );
}

function Motif({ box, className }: { box: keyof typeof BOXES; className: string }) {
  const { width, height } = BOXES[box];
  const motif = routeMotif({ width, height });
  const { node } = motif;
  const cy = node.y + node.height / 2;
  const fade = `motif-${box}-fade`;
  const lanes = [
    ...motif.incoming.map((d) => ({ d, colour: themeColor.muted, stroke: `url(#${fade})` })),
    ...motif.lp.map((d) => ({ d, colour: themeColor.accent, stroke: themeColor.accent })),
    ...motif.sp.map((d) => ({ d, colour: themeColor.sp, stroke: themeColor.sp })),
  ];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className={cx("h-auto w-full", className)}>
      <defs>
        {/* Incoming MUSD fades in from the left, so the lines never compete with the copy beside them. */}
        <linearGradient id={fade} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={node.x} y2="0">
          <stop offset="0" style={{ stopColor: themeColor.muted, stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: themeColor.muted, stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      {lanes.map(({ d, stroke }, i) => (
        <path key={`line-${i}`} d={d} pathLength={1} className="landing-draw" style={{ fill: "none", stroke, strokeOpacity: 0.35, strokeWidth: 1 }} />
      ))}
      {lanes.map(({ d, colour }, i) => (
        <path
          key={`flow-${i}`}
          d={d}
          className="motif-flow"
          style={{ fill: "none", stroke: colour, strokeWidth: 2.4, strokeLinecap: "round", animationDelay: `${-i * 0.53}s` }}
        />
      ))}
      <rect x={node.x - 6} y={node.y} width={node.width + 12} height={node.height} rx={node.height / 2} style={{ fill: themeColor.surface, stroke: themeColor.accent }} />
      <text x={node.x + node.width / 2} y={cy + 4} textAnchor="middle" fontSize={CHART_FONT_PX} className="font-semibold" style={{ fill: themeColor.accent }}>
        MezoRoute
      </text>
      <text x={width - 4} y={CHART_FONT_PX + 2} textAnchor="end" fontSize={CHART_FONT_PX} className="font-medium" style={{ fill: themeColor.accent }}>
        LP
      </text>
      <text x={width - 4} y={height - 4} textAnchor="end" fontSize={CHART_FONT_PX} className="font-medium" style={{ fill: themeColor.sp }}>
        Stability Pool
      </text>
    </svg>
  );
}
