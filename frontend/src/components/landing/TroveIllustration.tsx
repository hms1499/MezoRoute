import { CHART_FONT_PX, themeColor } from "@/lib/ui/tokens";

/** The Trove actions (U16): one flash swap on the pool either repays debt from collateral or adds BTC with new debt. Decorative. */
export function TroveIllustration() {
  const label = (x: number, y: number, text: string, fill: string, weight = "font-semibold") => (
    <text x={x} y={y} textAnchor="middle" fontSize={CHART_FONT_PX} className={weight} style={{ fill }}>
      {text}
    </text>
  );
  return (
    <svg aria-hidden viewBox="0 0 400 260" className="h-auto w-full">
      <rect x="60" y="12" width="280" height="56" rx="14" style={{ fill: themeColor.surface, stroke: themeColor.line }} />
      <path d="M200 22 L200 58" style={{ stroke: themeColor.line }} />
      {label(130, 45, "BTC collateral", themeColor.btc)}
      {label(270, 45, "MUSD debt", themeColor.ink)}
      <path d="M200 68 L200 100" pathLength={1} className="landing-draw" style={{ fill: "none", stroke: themeColor.accent, strokeWidth: 1.5 }} />
      <rect x="120" y="100" width="160" height="36" rx="18" style={{ fill: themeColor.surface, stroke: themeColor.accent }} />
      {label(200, 123, "Flash swap", themeColor.accent, "font-medium")}
      <path d="M200 136 C 200 156, 110 150, 110 172" pathLength={1} className="landing-draw" style={{ fill: "none", stroke: themeColor.accent, strokeWidth: 1.5 }} />
      <path d="M200 136 C 200 156, 290 150, 290 172" pathLength={1} className="landing-draw" style={{ fill: "none", stroke: themeColor.btc, strokeWidth: 1.5 }} />
      <rect x="30" y="172" width="160" height="72" rx="12" style={{ fill: themeColor["accent-soft"], stroke: themeColor.accent }} />
      {label(110, 204, "Unwind · Close", themeColor.accent)}
      {label(110, 224, "debt repaid from BTC", themeColor.muted, "font-normal")}
      <rect x="210" y="172" width="160" height="72" rx="12" style={{ fill: themeColor["btc-soft"], stroke: themeColor.btc }} />
      {label(290, 204, "Leverage", themeColor.btc)}
      {label(290, 224, "more BTC, more debt", themeColor.muted, "font-normal")}
    </svg>
  );
}
