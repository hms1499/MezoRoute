import type { ReactNode } from "react";
import { Settle } from "@/components/ui/Settle";

/**
 * Route pages (U1 §5): from 1024 px a form column and a sticky summary; below that one column, and
 * `mobileBar` is fixed at the bottom with the key figure and the primary action.
 */
export function RouteLayout({ header, summary, mobileBar, children }: { header: ReactNode; summary: ReactNode; mobileBar?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-6">
      {header}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start lg:gap-6">
        {/* U10: loading branches return a LoadingCard instead of this layout, so it mounts with the data and the
            content settles in once; refetches keep it mounted. */}
        <Settle index={0} className="space-y-4 lg:col-span-2">
          {children}
        </Settle>
        <aside aria-label="Summary" className="lg:sticky lg:top-6">
          <Settle index={1} className="space-y-4">
            {summary}
          </Settle>
        </aside>
      </div>
      {mobileBar}
    </div>
  );
}

/** The fixed bottom bar below 1024 px; AppShell pads the page bottom whenever one is present (`data-mobile-bar`). */
export function MobileBar({ figure, notice, action }: { figure?: ReactNode; notice?: ReactNode; action: ReactNode }) {
  return (
    <div data-mobile-bar className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 py-3 lg:hidden">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        <div className="min-w-0 text-sm">{notice ?? <span className="font-semibold">{figure}</span>}</div>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  );
}
