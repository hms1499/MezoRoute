import type { ReactNode } from "react";
import { Settle } from "@/components/ui/Settle";
import { FLOW_WIDTH } from "@/lib/ui/layout";
import { cx } from "@/lib/ui/cx";

// U11 §6.2: every flow page (amount, confirm, exit, withdraw, receipt) is one centred column of the same width, so
// the left edge never moves within a flow. It replaced RouteLayout and MobileBar (U11 Phase 2): the action sits in
// the card. The content settles in on mount only (U10), as RouteLayout's did.
//
// An `aside` (the LP planner's comparison and "Before you sign", U13) makes it a wide page instead (10 Nov, the
// user's call): the page width of Dashboard and Positions, in Positions' grid, the flow two thirds and the aside one
// from `lg`, stacked below it. Such a route is a wide route (`isFlowPath` false), so the banner spans the page too.

export function FlowColumn({ header, aside, children }: { header: ReactNode; aside?: ReactNode; children: ReactNode }) {
  if (aside === undefined) {
    return (
      <div className={cx("mx-auto w-full space-y-6", FLOW_WIDTH)}>
        {header}
        <Settle index={0} className="space-y-4">
          {children}
        </Settle>
      </div>
    );
  }
  return (
    <div className="w-full space-y-6">
      {header}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <Settle index={0} className="space-y-4 lg:col-span-2">
          {children}
        </Settle>
        <Settle index={1} className="space-y-4">
          {aside}
        </Settle>
      </div>
    </div>
  );
}
