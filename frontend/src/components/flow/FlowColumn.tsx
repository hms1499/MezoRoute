import type { ReactNode } from "react";
import { Settle } from "@/components/ui/Settle";

// U11 §6.2, U14 §A: every flow page (amount, confirm, exit, withdraw, receipt) sits at the page width of Dashboard and
// Positions, in Positions' grid: the flow's card two thirds and its aside (the facts the page already read: Before
// you sign, the position, the risks on Confirm from lg) one third from `lg`, stacked below it. Without an aside the
// third column stays empty, so the card's left edge and width never move between pages or while data arrive. The
// content settles in on mount only (U10).

export function FlowColumn({ header, aside, children }: { header: ReactNode | null; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="w-full space-y-6">
      {header}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <Settle index={0} className="space-y-4 lg:col-span-2">
          {children}
        </Settle>
        {aside !== undefined && (
          <Settle index={1} className="space-y-4">
            {aside}
          </Settle>
        )}
      </div>
    </div>
  );
}

/** A flow route's loading, error, connect, or no-executor state, on the card's edge and width (U14). */
export function FlowState({ children }: { children: ReactNode }) {
  return <FlowColumn header={null}>{children}</FlowColumn>;
}
