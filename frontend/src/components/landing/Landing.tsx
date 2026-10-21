"use client";

import { useState } from "react";
import { useMainnetReference } from "@/lib/reference/useMainnetReference";
import { FinalCta } from "./FinalCta";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { RouteLanes } from "./RouteLanes";
import { SimulatorSection } from "./SimulatorSection";
import { TrustRow } from "./TrustRow";

export type Highlight = "lp" | "sp" | null;

/** The first screen before a wallet connects: the U10 brand hero, the live simulator, and the story below it. */
export function Landing() {
  const { data, error } = useMainnetReference(true);
  const [highlight, setHighlight] = useState<Highlight>(null);
  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* The U2 glow, full-bleed behind the top of the page; it scrolls away with the hero. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] bg-night-glow" />
      <Hero data={data} error={error} />
      <SimulatorSection data={data} error={error} highlight={highlight} onHighlight={setHighlight} />
      <RouteLanes onHighlight={setHighlight} />
      <HowItWorks />
      <TrustRow />
      <FinalCta />
    </div>
  );
}
