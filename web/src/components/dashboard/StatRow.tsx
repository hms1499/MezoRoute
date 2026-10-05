import type { ReactNode } from "react";

/** One label/value pair in a card's `<dl>` grid, with an optional second line under the value. */
export function StatRow({
  label,
  sub,
  strong,
  children,
}: {
  label: string;
  sub?: string;
  strong?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <dt className={strong ? "font-semibold" : "text-muted"}>{label}</dt>
      <dd className={strong ? "text-right font-semibold" : "text-right"}>
        {children}
        {sub && <span className="block text-xs font-normal text-muted">{sub}</span>}
      </dd>
    </>
  );
}
