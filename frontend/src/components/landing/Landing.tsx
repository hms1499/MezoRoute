"use client";

import { useState } from "react";
import { amountState } from "@/lib/compare/view";
import { ROUTE_SECTIONS } from "@/lib/landing/sections";
import { WAD } from "@/lib/math";
import { useMainnetReference } from "@/lib/reference/useMainnetReference";
import { FinalCta } from "./FinalCta";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { RouteSection } from "./RouteSection";
import { SimulatorSection } from "./SimulatorSection";
import { TrustRow } from "./TrustRow";

export type Highlight = "lp" | "sp" | null;

/** The simulator's field: the typed text, its parsed amount (null while invalid), and the last valid amount shown. */
export type AmountState = { text: string; amount: bigint | null; error: string | null; shown: bigint };

const DEFAULT_AMOUNT = 1_000n * WAD;

/** The first screen before a wallet connects: the U10 brand hero, the live simulator, and the story below it. */
export function Landing() {
  const { data, error } = useMainnetReference(true);
  const [highlight, setHighlight] = useState<Highlight>(null);
  // U16: the page owns the amount, so the simulator and every planner link below use the same one.
  const [text, setText] = useState("1000");
  const [lastValid, setLastValid] = useState(DEFAULT_AMOUNT);
  const parsed = amountState(text);
  const amount: AmountState = { text, amount: parsed.amount, error: parsed.error, shown: parsed.amount ?? lastValid };
  function onText(next: string) {
    setText(next);
    const value = amountState(next).amount;
    if (value !== null) setLastValid(value);
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* The U2 glow, full-bleed behind the top of the page; it scrolls away with the hero. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] bg-night-glow" />
      <Hero data={data} error={error} />
      <SimulatorSection data={data} error={error} amountState={amount} onText={onText} highlight={highlight} onHighlight={setHighlight} />
      {ROUTE_SECTIONS.map((copy) => (
        <RouteSection key={copy.route} copy={copy} amount={amount.shown} onHighlight={setHighlight} />
      ))}
      <HowItWorks />
      <TrustRow />
      <FinalCta />
    </div>
  );
}
