"use client";

import { ArrowDown } from "lucide-react";
import { ConnectCta } from "@/components/home/ConnectCta";
import { buttonClass } from "@/components/ui/Button";
import type { MainnetReferenceData } from "@/lib/reference/load";
import type { Highlight } from "./Landing";
import { RouteMap } from "./RouteMap";
import { Simulator } from "./Simulator";

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

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
  return (
    <section className="grid grid-cols-1 items-start gap-10 py-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-14">
      <div>
        <p className="landing-rise font-mono text-xs text-night-lp">{"// route planner for MUSD on Mezo"}</p>
        <h1 className="mt-3 text-4xl font-bold leading-[1.04] tracking-tight text-night-ink sm:text-5xl">
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
        <div className="landing-rise mt-6 flex flex-wrap items-center gap-3" style={delay(320)}>
          <ConnectCta variant="night" />
          <a href="#how-it-works" className={buttonClass("nightGhost")}>
            How it works
            <ArrowDown aria-hidden className="h-4 w-4" />
          </a>
        </div>
        <RouteMap highlight={highlight} className="mt-8 hidden lg:block" />
      </div>
      <div className="landing-rise" style={delay(450)}>
        <Simulator data={data} error={error} onHighlight={onHighlight} />
      </div>
      <RouteMap highlight={highlight} className="lg:hidden" />
    </section>
  );
}
