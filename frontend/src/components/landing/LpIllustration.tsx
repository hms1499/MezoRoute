import { CHART_FONT_PX, themeColor } from "@/lib/ui/tokens";

/** The LP route (U10): MUSD goes in and becomes a pool share that is about half BTC and half MUSD. Decorative. */
export function LpIllustration() {
  return (
    <svg aria-hidden viewBox="0 0 400 260" className="h-auto w-full">
      <rect x="110" y="20" width="180" height="40" rx="20" style={{ fill: themeColor.surface, stroke: themeColor.accent }} />
      <text x="200" y="44" textAnchor="middle" fontSize={CHART_FONT_PX} className="font-medium" style={{ fill: themeColor.accent }}>
        MUSD in
      </text>
      <path d="M200 60 C 200 110, 110 110, 110 150" pathLength={1} className="landing-draw" style={{ fill: "none", stroke: themeColor.btc, strokeWidth: 1.5 }} />
      <path d="M200 60 C 200 110, 290 110, 290 150" pathLength={1} className="landing-draw" style={{ fill: "none", stroke: themeColor.accent, strokeWidth: 1.5 }} />
      <rect x="30" y="150" width="160" height="80" rx="12" style={{ fill: themeColor["btc-soft"], stroke: themeColor.btc }} />
      <text x="110" y="186" textAnchor="middle" fontSize={CHART_FONT_PX} className="font-semibold" style={{ fill: themeColor.btc }}>
        ≈ half BTC
      </text>
      <text x="110" y="206" textAnchor="middle" fontSize={CHART_FONT_PX} style={{ fill: themeColor.muted }}>
        moves with the price
      </text>
      <rect x="210" y="150" width="160" height="80" rx="12" style={{ fill: themeColor["accent-soft"], stroke: themeColor.accent }} />
      <text x="290" y="186" textAnchor="middle" fontSize={CHART_FONT_PX} className="font-semibold" style={{ fill: themeColor.accent }}>
        ≈ half MUSD
      </text>
      <text x="290" y="206" textAnchor="middle" fontSize={CHART_FONT_PX} style={{ fill: themeColor.muted }}>
        earns swap fees
      </text>
    </svg>
  );
}
