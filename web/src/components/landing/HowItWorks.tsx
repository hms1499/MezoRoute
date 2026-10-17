"use client";

import { useInView } from "./hooks";

const STEPS = [
  { n: "1", title: "Compare", detail: "Both routes for one amount: fees, BTC exposure, and the last 30 days on chain." },
  { n: "2", title: "Preview", detail: "Exact amounts and minimums from one block, with a live quote timer." },
  {
    n: "3",
    title: "Sign and exit",
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
      className="landing-section landing-reveal scroll-mt-6"
    >
      <h2 id="how-heading" className="landing-section-title text-2xl tracking-tight">
        Three steps, every number shown before you sign
      </h2>
      <div aria-hidden className="relative mt-8 hidden h-px bg-line sm:block">
        <span data-seen={seen} className="landing-fill absolute inset-0 origin-left bg-accent" />
      </div>
      <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.n}>
            <p className="flex items-center gap-3 text-base font-semibold text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-accent text-sm text-accent">{step.n}</span>
              {step.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-night-muted">{step.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
