import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

// U11 §6.1: the disclosure under the action card (What happens, the "If BTC moves" chart, the full risk list),
// closed by default on the amount page. The card's one risk line links here (`#details`).

export function Details({
  id = "details",
  summary = "Details",
  defaultOpen = false,
  children,
}: {
  id?: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen || undefined} className="group scroll-mt-6 border-t border-line pt-4">
      <summary className="hit flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-base font-semibold [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown aria-hidden className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4 space-y-6">{children}</div>
    </details>
  );
}
