"use client";

import { useInView } from "./hooks";

const STEPS = [
  { n: "01", title: "compare", detail: "Both routes for one amount: fees, BTC exposure, and the last 30 days on chain." },
  { n: "02", title: "preview", detail: "Exact amounts and minimums from one block, with a live quote timer." },
  {
    n: "03",
    title: "sign & exit",
    detail: "One transaction each way after an approval where your wallet needs one; exit back to MUSD from Positions.",
  },
];

export function HowItWorks() {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section
      ref={ref}
      id="how-it-works"
      data-seen={seen}
      aria-labelledby="how-heading"
      className="landing-reveal scroll-mt-6 border-t border-night-line py-14"
    >
      <p className="font-mono text-xs text-night-lp">{"// how it works"}</p>
      <h2 id="how-heading" className="mt-2 text-2xl font-semibold tracking-tight text-night-ink">
        Three steps, every number shown before you sign
      </h2>
      <div aria-hidden className="relative mt-8 hidden h-px bg-night-line sm:block">
        <span data-seen={seen} className="landing-fill absolute inset-0 origin-left bg-night-lp" />
      </div>
      <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.n}>
            <p className="font-mono text-sm text-night-ink">
              <span className="text-night-lp">{step.n}</span> {step.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-night-muted">{step.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
