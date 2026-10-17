"use client";

import { ConnectCta } from "@/components/home/ConnectCta";
import { useInView } from "./hooks";

export function FinalCta() {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} data-seen={seen} aria-labelledby="final-heading" className="landing-section landing-reveal text-center">
      <h2 id="final-heading" className="landing-section-title text-3xl tracking-tight [text-wrap:balance]">
        Bitcoin wallet or EVM wallet, same routes.
      </h2>
      <div className="mt-6 flex justify-center">
        <ConnectCta variant="primary" />
      </div>
    </section>
  );
}
