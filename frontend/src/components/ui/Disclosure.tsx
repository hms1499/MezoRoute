import { ChevronDown, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

/**
 * U21: background reading (how a figure is made, how a mechanism works) behind a short summary, so the page shows the
 * figures first. Never for a risk the person should read before signing (DESIGN.md: don't hide a risk).
 */
export function Disclosure({ summary, children, className }: { summary: string; children: ReactNode; className?: string }) {
  return (
    <details className={cx("group text-sm", className)}>
      <summary className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full font-medium text-accent hover:underline">
        <Info aria-hidden className="h-4 w-4 shrink-0" />
        {summary}
        <ChevronDown aria-hidden className="h-4 w-4 shrink-0 transition-transform duration-fast group-open:rotate-180" />
      </summary>
      <div className="mt-1 leading-relaxed text-muted">{children}</div>
    </details>
  );
}
