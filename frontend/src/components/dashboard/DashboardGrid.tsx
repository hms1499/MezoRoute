import type { ReactNode } from "react";

/**
 * U15: the Dashboard's one grid. From lg the left column holds Your positions then If BTC moves, the right column
 * Put your MUSD to work then Your Trove, each at its own height, so no card sits half empty beside a taller one.
 * Below lg the columns dissolve (`contents`) and `order` gives the reading order: positions, routes, chart, Trove.
 */
export function DashboardGrid({ positions, routes, exposure, trove }: { positions: ReactNode; routes: ReactNode; exposure: ReactNode; trove: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="contents lg:block lg:space-y-6">
        <div className="order-1">{positions}</div>
        <div className="order-3">{exposure}</div>
      </div>
      <div className="contents lg:block lg:space-y-6">
        <div className="order-2">{routes}</div>
        <div className="order-4">{trove}</div>
      </div>
    </div>
  );
}
