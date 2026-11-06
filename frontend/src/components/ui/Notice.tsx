import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// U11 §5.5: four tones. Neutral is for information and empty states; danger only for errors.
const TONES = {
  neutral: { box: "bg-well text-ink", Icon: Info },
  warning: { box: "bg-warning-bg text-warning-ink", Icon: TriangleAlert },
  danger: { box: "bg-danger-soft text-danger", Icon: CircleAlert },
  success: { box: "bg-accent-soft text-accent", Icon: CircleCheck },
} as const;

export type NoticeTone = keyof typeof TONES;

/** An inline message with an icon (colour never carries the meaning alone) and an optional action. */
export function Notice({
  tone = "neutral",
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
    <div role={role} className={cx("flex flex-wrap items-start gap-x-3 gap-y-2 rounded-inset px-4 py-3 text-sm", box, className)}>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      {/* At least 12rem of text before the action wraps under it, so a narrow screen never squeezes the message. */}
      <div className="min-w-0 flex-1 basis-48">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
