"use client";

import { ConnectCta } from "@/components/home/ConnectCta";
import { ButtonLink } from "@/components/ui/Button";
import { REPOSITORY } from "@/lib/config/links";
import { useInView } from "./hooks";

/**
 * The closing panel: the hero's glow in a bounded surface, one line of proof, and the two ways in. No section
 * hairline or padding: the panel's border frames it, TrustRow's padding and the footer's margin space it.
 */
export function FinalCta() {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} data-seen={seen} aria-labelledby="final-heading" className="landing-reveal">
      <div className="landing-panel relative overflow-hidden px-4 py-12 text-center sm:px-10 sm:py-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-night-glow opacity-90" />
        <div className="relative">
          <h2 id="final-heading" className="landing-section-title text-3xl tracking-tight [text-wrap:balance]">
            Bitcoin wallet or EVM wallet, same routes.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-night-muted [text-wrap:balance]">
            Compare both routes on live Mezo data and check every amount before you sign.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <ConnectCta variant="primary" className="w-full sm:w-auto" />
            <ButtonLink href={REPOSITORY} external variant="nightGhost" className="w-full sm:w-auto">
              Read the source
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
