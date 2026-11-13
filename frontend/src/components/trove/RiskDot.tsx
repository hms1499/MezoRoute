import type { LiquidationRisk, RedemptionRisk } from "@/lib/trove/risk";
import { cx } from "@/lib/ui/cx";

// U20: Liquity V2's status dot. Low takes the accent (today's Healthy badge; `positive` is for signed figures only).
const LEVELS = {
  low: { text: "Low", dot: "bg-accent" },
  medium: { text: "Medium", dot: "bg-warning-ink" },
  high: { text: "High", dot: "bg-danger" },
  liquidatable: { text: "Liquidatable", dot: "bg-danger" },
} as const;

export type RiskDotLevel = LiquidationRisk | RedemptionRisk | "loading" | "unreadable" | "not-applicable" | null;

/** A risk level as a dot and a word (the word carries the meaning; the dot only repeats it). */
export function RiskDot({ level }: { level: RiskDotLevel }) {
  if (level === null || level === "not-applicable") return <span className="font-medium text-muted">—</span>;
  if (level === "loading") return <span className="font-medium text-muted">Reading…</span>;
  if (level === "unreadable") return <span className="font-medium text-muted">Not readable</span>;
  const { text, dot } = LEVELS[level];
  return (
    <span className={cx("inline-flex items-center gap-2 font-medium", level === "liquidatable" && "text-danger")}>
      <span aria-hidden className={cx("h-2 w-2 shrink-0 rounded-full", dot)} />
      {text}
    </span>
  );
}
