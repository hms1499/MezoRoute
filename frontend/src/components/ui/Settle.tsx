import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

/**
 * Content that replaces a skeleton (U10): it fades in and rises 8 px, staggered by `index` (60 ms apart). It
 * animates on mount only, so a refetch that keeps it mounted never replays it; still under reduced motion.
 */
export function Settle({
  index = 0,
  as: Tag = "div",
  className,
  children,
}: {
  index?: number;
  as?: "div" | "span" | "li" | "dd";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={cx("settle", className)} style={{ "--i": index } as CSSProperties}>
      {children}
    </Tag>
  );
}
