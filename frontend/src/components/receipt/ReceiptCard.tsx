import type { ReactNode } from "react";
import { Overview, type OverviewRow } from "@/components/flow/Overview";
import { ButtonLink } from "@/components/ui/Button";

// U11 §6.2: the receipt card: the status icon, the h1 title, what the events say happened, and one forward primary,
// View positions. U14: which transaction it was (hash with the explorer link, block, gas, fee) is the page's aside.

export function ReceiptCard({
  icon,
  title,
  message,
  rows,
  extra,
}: {
  icon: ReactNode;
  title: ReactNode;
  message?: ReactNode;
  rows?: OverviewRow[];
  extra?: ReactNode;
}) {
  return (
    <section className="card space-y-4">
      <div className="flex flex-col items-center gap-3 text-center">
        {icon}
        <h1 className="text-title [text-wrap:balance]">{title}</h1>
        {message && <p className="text-sm text-muted">{message}</p>}
      </div>
      {rows && rows.length > 0 && <Overview rows={rows} />}
      {extra}
      <div className="grid gap-2">
        <ButtonLink href="/positions/" className="w-full" arrow>
          View positions
        </ButtonLink>
        <ButtonLink href="/" variant="ghost" className="w-full">
          Back to dashboard
        </ButtonLink>
      </div>
    </section>
  );
}
