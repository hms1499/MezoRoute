"use client";

import { networks } from "@/lib/config/networks";
import { simulateRoutes } from "@/lib/landing/simulate";
import type { MainnetReferenceData } from "@/lib/reference/load";
import { HeroChart } from "./HeroChart";
import type { AmountState, Highlight } from "./Landing";
import { Simulator } from "./Simulator";

const EXECUTOR_FEE_BPS = networks.mainnet.executor?.feeBps ?? 0n;

/**
 * The first section under the hero (U10; the U2/U3 hero's simulator and chart): both routes for a typed amount on
 * live Mezo mainnet data. The table and the chart show the same amount; `Landing` owns it (U16), so the planner links
 * below carry it too.
 */
export function SimulatorSection({
  data,
  error,
  amountState: { text, amount, error: amountError, shown },
  onText,
  highlight,
  onHighlight,
}: {
  data: MainnetReferenceData | undefined;
  amountState: AmountState;
  onText: (text: string) => void;
  error: Error | null;
  highlight: Highlight;
  onHighlight: (highlight: Highlight) => void;
}) {
  const sim = data ? simulateRoutes({ reference: data.reference, history: data.history, amount: shown, executorFeeBps: EXECUTOR_FEE_BPS }) : null;

  return (
    <section id="simulator" aria-label="Try an amount" className="grid grid-cols-1 pb-16 pt-10 items-start gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
      <HeroChart sim={sim} highlight={highlight} className="order-2 lg:order-1" />
      <div className="order-1 lg:order-2">
        <Simulator text={text} onText={onText} amount={amount} amountError={amountError} planAmount={shown} sim={sim} error={error} onHighlight={onHighlight} />
      </div>
    </section>
  );
}
