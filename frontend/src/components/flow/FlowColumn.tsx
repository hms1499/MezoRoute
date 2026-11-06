import type { ReactNode } from "react";
import { Settle } from "@/components/ui/Settle";

// U11 §6.2: every flow page (amount, confirm, exit, withdraw, receipt) is one centred column of the same width, so
// the left edge never moves within a flow. It replaced RouteLayout and MobileBar (U11 Phase 2): the action sits in
// the card. The content settles in on mount only (U10), as RouteLayout's did.

export function FlowColumn({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[520px] space-y-6">
      {header}
      <Settle index={0} className="space-y-4">
        {children}
      </Settle>
    </div>
  );
}
