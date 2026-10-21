import { CHART_FONT_PX, themeColor } from "@/lib/ui/tokens";

const DROPS = [
  { x: 130, y: 40 },
  { x: 175, y: 70 },
  { x: 215, y: 30 },
  { x: 255, y: 62 },
  { x: 290, y: 44 },
];

/** The Stability Pool (U10): MUSD stays MUSD, and BTC arrives only when liquidations happen. Decorative. */
export function SpIllustration() {
  return (
    <svg aria-hidden viewBox="0 0 400 260" className="h-auto w-full">
      <text x="200" y="18" textAnchor="middle" fontSize={CHART_FONT_PX} className="font-medium" style={{ fill: themeColor.btc }}>
        BTC from liquidations
      </text>
      {DROPS.map(({ x, y }) => (
        <g key={x}>
          <path d={`M${x} ${y + 8} L ${x} 140`} style={{ stroke: themeColor.btc, strokeOpacity: 0.4, strokeDasharray: "2 6" }} />
          <circle cx={x} cy={y} r="7" style={{ fill: themeColor["btc-soft"], stroke: themeColor.btc }} />
        </g>
      ))}
      <rect x="70" y="140" width="260" height="90" rx="14" style={{ fill: themeColor["sp-soft"], stroke: themeColor.sp }} />
      <text x="200" y="180" textAnchor="middle" fontSize={CHART_FONT_PX} className="font-semibold" style={{ fill: themeColor.sp }}>
        MUSD in the Stability Pool
      </text>
      <text x="200" y="200" textAnchor="middle" fontSize={CHART_FONT_PX} style={{ fill: themeColor.muted }}>
        stays MUSD, no BTC exposure until a gain
      </text>
    </svg>
  );
}
