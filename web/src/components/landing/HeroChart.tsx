"use client";

import { BtcMoveChart } from "@/components/chart/BtcMoveChart";
import { formatToken } from "@/lib/format";
import { heroSeries } from "@/lib/landing/hero-chart";
import type { LandingSimulation } from "@/lib/landing/simulate";
import { cx } from "@/lib/ui/cx";
import type { Highlight } from "./Landing";

const musd = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** The hero's "If BTC moves" chart for the simulator's amount (U3 §4.2): the LP moves with BTC, the Stability Pool stays flat. */
export function HeroChart({ sim, highlight, className }: { sim: LandingSimulation | null; highlight: Highlight; className?: string }) {
  const series = heroSeries(sim);
  return (
    <div className={className}>
      <BtcMoveChart
        plots={[{ title: "Value in MUSD if BTC moves", series, format: musd }]}
        ariaLabel={describe(sim)}
        highlight={highlight}
        drawIn
      />
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <Caption route="lp" on={highlight === "lp"}>
          LP: about half in BTC, so it moves with the price.
        </Caption>
        <Caption route="sp" on={highlight === "sp"}>
          Stability Pool: stays in MUSD; BTC arrives only from liquidations.
        </Caption>
      </ul>
    </div>
  );
}

function Caption({ route, on, children }: { route: "lp" | "sp"; on: boolean; children: string }) {
  return (
    <li className={cx("flex items-start gap-2", on && "text-ink")}>
      <span aria-hidden className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", route === "lp" ? "bg-accent" : "bg-sp")} />
      {children}
    </li>
  );
}

function describe(sim: LandingSimulation | null): string {
  if (!sim) return "Chart of both routes' value if BTC moves 30% either way; loading Mezo mainnet figures.";
  const sp = `the Stability Pool deposit stays at ${formatToken(sim.sp.positionValue, 18, 0)} MUSD`;
  if (sim.lp.status !== "ok") return `If BTC moves 30% either way, ${sp}.`;
  return `If BTC falls 30%, the LP position is worth about ${formatToken(sim.lp.valueAfterDrop, 18, 2)} MUSD and ${sp}.`;
}
