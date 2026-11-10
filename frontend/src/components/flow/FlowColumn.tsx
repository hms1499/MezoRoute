import type { ReactNode } from "react";
import { Settle } from "@/components/ui/Settle";

// U11 §6.2: every flow page (amount, confirm, exit, withdraw, receipt) is one centred column of the same width, so
// the left edge never moves within a flow. It replaced RouteLayout and MobileBar (U11 Phase 2): the action sits in
// the card. The content settles in on mount only (U10), as RouteLayout's did.
//
// U13: an optional `aside` (the planner's comparison and "Before you sign") widens the column to 876 px from `lg`
// only: a 520 px flow beside a 340 px aside, 16 px apart, both starting at the top. Below `lg`, and on every page
// without an aside, the column is exactly what it was.

export function FlowColumn({ header, aside, children }: { header: ReactNode; aside?: ReactNode; children: ReactNode }) {
  if (aside === undefined) {
    return (
      <div className="mx-auto w-full max-w-[520px] space-y-6">
        {header}
        <Settle index={0} className="space-y-4">
          {children}
        </Settle>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-[520px] space-y-6 lg:grid lg:max-w-[876px] lg:grid-cols-[520px_340px] lg:items-start lg:gap-4 lg:space-y-0">
      <div className="space-y-6 lg:col-start-1">
        {header}
        <Settle index={0} className="space-y-4">
          {children}
        </Settle>
      </div>
      <Settle index={1} className="space-y-4 lg:col-start-2">
        {aside}
      </Settle>
    </div>
  );
}
