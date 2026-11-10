import type { ReactNode } from "react";
import { Settle } from "@/components/ui/Settle";
import { FLOW_WIDTH } from "@/lib/ui/layout";
import { cx } from "@/lib/ui/cx";

// U11 §6.2: every flow page (amount, confirm, exit, withdraw, receipt) is one centred column of the same width, so
// the left edge never moves within a flow. It replaced RouteLayout and MobileBar (U11 Phase 2): the action sits in
// the card. The content settles in on mount only (U10), as RouteLayout's did.
//
// U13 put an optional `aside` (the planner's comparison and "Before you sign") beside the flow; since 10 Nov it sits
// in a right rail from `xl` only. The grid has equal rails either side of the 520 px column, so the flow stays where
// every other flow page has it (U13 had shifted it 178 px left at 1440 px). The rails are 276 px at the shell's full
// width; below `xl` they would be under 230 px, so the aside stacks under the flow there, as on a phone.

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
    <div
      data-flow-aside
      className={cx(
        "mx-auto w-full space-y-6",
        FLOW_WIDTH,
        "xl:grid xl:max-w-none xl:grid-cols-[minmax(0,1fr)_520px_minmax(0,1fr)] xl:items-start xl:gap-4 xl:space-y-0",
      )}
    >
      <div className="space-y-6 xl:col-start-2 xl:row-start-1">
        {header}
        <Settle index={0} className="space-y-4">
          {children}
        </Settle>
      </div>
      <Settle index={1} className="space-y-4 xl:col-start-3 xl:row-start-1">
        {aside}
      </Settle>
    </div>
  );
}
