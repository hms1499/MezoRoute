"use client";

import { useState } from "react";
import { useDarkSurface } from "@/components/surface";
import { liveStrip } from "@/lib/landing/view";
import { useMainnetReference } from "@/lib/reference/useMainnetReference";
import { FinalCta } from "./FinalCta";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { LiveStrip } from "./LiveStrip";
import { RouteLanes } from "./RouteLanes";
import { TrustRow } from "./TrustRow";

export type Highlight = "lp" | "sp" | null;

/** The first screen before a wallet connects (U2): dark route map, live simulator, and the story below it. */
export function Landing() {
  useDarkSurface();
  const { data, error } = useMainnetReference(true);
  const [highlight, setHighlight] = useState<Highlight>(null);
  return (
    <div className="mx-auto w-full max-w-6xl">
      <Hero data={data} error={error} highlight={highlight} onHighlight={setHighlight} />
      <LiveStrip live={liveStrip(data, error)} />
      <RouteLanes onHighlight={setHighlight} />
      <HowItWorks />
      <TrustRow />
      <FinalCta />
    </div>
  );
}
