"use client";

import { ArrowDown } from "lucide-react";
import { ConnectCta } from "@/components/home/ConnectCta";
import { ButtonContent, buttonClass } from "@/components/ui/Button";
import { liveStrip } from "@/lib/landing/view";
import type { MainnetReferenceData } from "@/lib/reference/load";
import { HeroFigures } from "./HeroFigures";
import { RouteMotif } from "./RouteMotif";

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });
const CORNERS = ["-left-[5px] -top-[5px]", "-right-[5px] -top-[5px]", "-bottom-[5px] -left-[5px]", "-bottom-[5px] -right-[5px]"];

/**
 * The landing's first screen (U10, morpho.org's rhythm): a light headline, the two ways in, Mezo mainnet today, and
 * the route motif, inside a framed grid. The simulator is the next section (`#simulator`).
 */
export function Hero({ data, error }: { data: MainnetReferenceData | undefined; error: Error | null }) {
  const live = liveStrip(data, error);
  return (
    <section aria-labelledby="hero-heading" className="pt-6 lg:pt-10">
      <div className="landing-frame relative">
        {CORNERS.map((corner) => (
          <span key={corner} aria-hidden className={`frame-cross ${corner}`} />
        ))}
        <div className="grid grid-cols-1 gap-8 px-5 py-8 sm:px-8 lg:min-h-[520px] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-6 lg:px-12 lg:py-12">
          <div className="min-w-0">
            <h1 id="hero-heading" className="text-display text-ink sm:text-display-lg">
              <span className="landing-rise block" style={delay(80)}>
                Route MUSD.
              </span>
              <span className="landing-rise block" style={delay(160)}>
                Know the BTC risk.
              </span>
            </h1>
            <p className="landing-rise mt-5 max-w-md text-base leading-relaxed text-muted" style={delay(240)}>
              Compare the MUSD/BTC pool with the Stability Pool on live Mezo data, preview the exact transaction, and exit
              back to MUSD. Non-custodial.
            </p>
            {/* Below 640 px the two actions stack at full width. */}
            <div className="landing-rise mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center" style={delay(320)}>
              {/* With the arrow circle the full label wraps below 640 px. */}
              <ConnectCta variant="primary" className="w-full sm:w-auto" arrow label={<><span className="sm:hidden">Connect a wallet</span><span className="max-sm:hidden">Connect a Bitcoin or EVM wallet</span></>} />
              <a href="#simulator" className={buttonClass("secondary", "md", "w-full sm:w-auto", true)}>
                <ButtonContent variant="secondary" arrow>
                  Compare routes
                </ButtonContent>
              </a>
            </div>
            <div className="landing-rise mt-10" style={delay(400)}>
              <HeroFigures live={live} />
            </div>
          </div>
          <RouteMotif className="min-w-0" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs text-muted">
        <a href="#simulator" className="inline-flex min-h-9 items-center gap-1.5 font-medium text-accent underline-offset-4 hover:underline">
          Try an amount
          <ArrowDown aria-hidden className="h-3.5 w-3.5" />
        </a>
        {live.kind === "data" && <span>{live.caption}</span>}
      </div>
    </section>
  );
}
