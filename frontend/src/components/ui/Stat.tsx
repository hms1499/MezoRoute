import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

/** One label/value pair inside a `<dl className="stat-list">`, with an optional second line under the value. */
export function Stat({
  label,
  sub,
  strong,
  tone,
  figure,
  children,
}: {
  label: ReactNode;
  sub?: ReactNode;
  strong?: boolean;
  tone?: "btc";
  /** U11 §5.2: the value is a position's figure (xl/500), the same role it has in the card above. */
  figure?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <dt className={strong ? "font-semibold" : "text-muted"}>{label}</dt>
      <dd className={cx("min-w-0 text-right [overflow-wrap:anywhere]", strong && !figure && "font-semibold", figure && "text-xl font-medium", tone === "btc" && "text-btc")}>
        {children}
        {sub && <span className="ml-auto block max-w-44 text-xs font-normal text-muted">{sub}</span>}
      </dd>
    </>
  );
}
