import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

const TONES = {
  neutral: "bg-line text-muted",
  accent: "bg-accent-soft text-accent",
  btc: "bg-btc-soft text-btc",
  warning: "bg-warning-bg text-warning-ink",
  danger: "bg-danger-soft text-danger",
} as const;

export function Badge({ tone = "neutral", icon, children }: { tone?: keyof typeof TONES; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone])}>
      {icon}
      {children}
    </span>
  );
}
