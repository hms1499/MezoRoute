import { cx } from "@/lib/ui/cx";

// U11 §5.6: the one table style. Header 12/500 muted, left for the first column and right for figures; rows 14/400
// with 12 px vertical padding (12/400 and 8 px in a dense side-panel table); a line divider; no zebra striping.

type Align = "left" | "right";

export function tableClass(dense = false): string {
  return cx("w-full border-collapse", dense ? "text-xs" : "text-sm");
}

export function thClass(align: Align, dense = false): string {
  return cx("border-b border-line text-xs font-medium text-muted", dense ? "py-2" : "py-2", align === "right" ? "text-right" : "text-left");
}

/** A row header (`th scope="row"`): body weight, left-aligned. */
export function rowThClass(dense = false): string {
  return cx("text-left font-normal", dense ? "py-2" : "py-3");
}

export function tdClass(align: Align, dense = false): string {
  return cx(dense ? "py-2" : "py-3", align === "right" ? "text-right" : "text-left");
}

/** A body row: the divider between rows. */
export const trClass = "border-b border-line last:border-b-0";
