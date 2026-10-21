"use client";

import { useState } from "react";
import { amountState } from "@/lib/compare/view";
import { networks } from "@/lib/config/networks";
import { simulateRoutes } from "@/lib/landing/simulate";
import { WAD } from "@/lib/math";
import type { MainnetReferenceData } from "@/lib/reference/load";
import { HeroChart } from "./HeroChart";
import type { Highlight } from "./Landing";
import { Simulator } from "./Simulator";

const DEFAULT_AMOUNT = 1_000n * WAD;
const EXECUTOR_FEE_BPS = networks.mainnet.executor?.feeBps ?? 0n;

/**
 * The first section under the hero (U10; the U2/U3 hero's simulator and chart): both routes for a typed amount on
 * live Mezo mainnet data. It owns the amount, so the table and the chart always show the same figures.
 */
export function SimulatorSection({
  data,
  error,
  highlight,
  onHighlight,
}: {
  data: MainnetReferenceData | undefined;
  error: Error | null;
  highlight: Highlight;
  onHighlight: (highlight: Highlight) => void;
}) {
  const [text, setText] = useState("1000");
  const [lastValid, setLastValid] = useState(DEFAULT_AMOUNT);
  const { amount, error: amountError } = amountState(text);
  const shown = amount ?? lastValid;
  const sim = data ? simulateRoutes({ reference: data.reference, history: data.history, amount: shown, executorFeeBps: EXECUTOR_FEE_BPS }) : null;
  function onText(next: string) {
    setText(next);
    const parsed = amountState(next).amount;
    if (parsed !== null) setLastValid(parsed);
  }

  return (
    <section id="simulator" aria-label="Try an amount" className="grid grid-cols-1 pb-14 pt-10 items-start gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
      <HeroChart sim={sim} highlight={highlight} className="order-2 lg:order-1" />
      <div className="order-1 lg:order-2">
        <Simulator text={text} onText={onText} amount={amount} amountError={amountError} sim={sim} error={error} onHighlight={onHighlight} />
      </div>
    </section>
  );
}
