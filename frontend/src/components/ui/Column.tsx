import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

/** A page's content width: narrow (672 px) for single-column pages, wide (1152 px) for two-column ones. */
export function Column({ width = "narrow", children }: { width?: "narrow" | "wide"; children: ReactNode }) {
  return <div className={cx("mx-auto w-full space-y-4", width === "narrow" ? "max-w-2xl" : "max-w-6xl")}>{children}</div>;
}
