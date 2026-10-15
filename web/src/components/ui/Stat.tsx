import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

/** One label/value pair inside a `<dl className="stat-list">`, with an optional second line under the value. */
export function Stat({
  label,
  sub,
  strong,
  tone,
  children,
}: {
  label: string;
  sub?: string;
  strong?: boolean;
  tone?: "btc";
  children: ReactNode;
}) {
  return (
    <>
      <dt className={strong ? "font-semibold" : "text-muted"}>{label}</dt>
      <dd className={cx("min-w-0 text-right [overflow-wrap:anywhere]", strong && "font-semibold", tone === "btc" && "text-btc")}>
        {children}
        {sub && <span className="block text-xs font-normal text-muted">{sub}</span>}
      </dd>
    </>
  );
}
