import type { ReactNode } from "react";
import { Settle } from "@/components/ui/Settle";
import { FLOW_WIDTH } from "@/lib/ui/layout";
import { cx } from "@/lib/ui/cx";

// U11 §6.2: every flow page (amount, confirm, exit, withdraw, receipt) is one centred column of the same width, so
// the left edge never moves within a flow. It replaced RouteLayout and MobileBar (U11 Phase 2): the action sits in
// the card. The content settles in on mount only (U10), as RouteLayout's did.
//
// U13 put an optional `aside` (the planner's comparison and "Before you sign") beside the flow, which made the LP
// planner the one flow page wider than 520 px and moved its left edge. Since 10 Nov the aside stacks under the flow,
// in the same column, at every width: every flow page has one width.

export function FlowColumn({ header, aside, children }: { header: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className={cx("mx-auto w-full space-y-6", FLOW_WIDTH)}>
      {header}
      <Settle index={0} className="space-y-4">
        {children}
      </Settle>
      {aside !== undefined && (
        <Settle index={1} className="space-y-4">
          {aside}
        </Settle>
      )}
    </div>
  );
}
