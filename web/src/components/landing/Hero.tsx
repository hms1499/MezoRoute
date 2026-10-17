"use client";

import { ArrowDown } from "lucide-react";
import { useState } from "react";
import { ConnectCta } from "@/components/home/ConnectCta";
import { buttonClass } from "@/components/ui/Button";
import { amountState } from "@/lib/compare/view";
import { networks } from "@/lib/config/networks";
import { simulateRoutes } from "@/lib/landing/simulate";
import { WAD } from "@/lib/math";
import type { MainnetReferenceData } from "@/lib/reference/load";
import { HeroChart } from "./HeroChart";
import type { Highlight } from "./Landing";
import { Simulator } from "./Simulator";

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });
const DEFAULT_AMOUNT = 1_000n * WAD;
const EXECUTOR_FEE_BPS = networks.mainnet.executor?.feeBps ?? 0n;

export function Hero({
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
  // The hero owns the amount, so the simulator's table and the chart always show the same figures.
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
    <section className="grid grid-cols-1 items-start gap-10 py-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-14">
      <div>
        <h1 className="text-[40px] font-bold leading-[48px] tracking-tight text-ink sm:text-[48px] sm:leading-[52px]">
          <span className="landing-rise block" style={delay(80)}>
            Pick a route.
          </span>
          <span className="landing-rise block" style={delay(160)}>
            Know the BTC risk.
          </span>
        </h1>
        <p className="landing-rise mt-4 max-w-md text-base leading-relaxed text-night-muted" style={delay(240)}>
          Compare the MUSD/BTC pool with the Stability Pool on live Mezo data, preview the exact transaction, and exit
          back to MUSD. Non-custodial.
        </p>
        {/* Below 640 px the two actions stack at full width, so the ghost link lines up with the primary. */}
        <div className="landing-rise mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center" style={delay(320)}>
          <ConnectCta variant="primary" className="w-full sm:w-auto" />
          <a href="#how-it-works" className={buttonClass("ghost", "md", "w-full sm:w-auto")}>
            How it works
            <ArrowDown aria-hidden className="h-4 w-4" />
          </a>
        </div>
        <HeroChart sim={sim} highlight={highlight} className="mt-10 hidden lg:block" />
      </div>
      <div className="landing-rise" style={delay(450)}>
        <Simulator text={text} onText={onText} amount={amount} amountError={amountError} sim={sim} error={error} onHighlight={onHighlight} />
      </div>
      <HeroChart sim={sim} highlight={highlight} className="lg:hidden" />
    </section>
  );
}
