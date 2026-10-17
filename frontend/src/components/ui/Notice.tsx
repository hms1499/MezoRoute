import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

const TONES = {
  info: { box: "bg-accent-soft text-accent", Icon: Info },
  warning: { box: "bg-warning-bg text-warning-ink", Icon: TriangleAlert },
  danger: { box: "bg-danger-soft text-danger", Icon: CircleAlert },
} as const;

/** An inline message with an icon (colour never carries the meaning alone) and an optional action. */
export function Notice({
  tone = "info",
  role,
  action,
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  role?: "alert" | "status" | "note";
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const { box, Icon } = TONES[tone];
  return (
    <div role={role} className={cx("flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl px-4 py-3 text-sm", box, className)}>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
