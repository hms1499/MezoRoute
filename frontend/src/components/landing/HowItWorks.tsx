"use client";

import { Calculator, PenLine, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { useInView } from "./hooks";

// U16: plan, sign, manage, each step marked by an icon and one short line.
const STEPS: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: Calculator, title: "Plan", detail: "Both routes for one amount. No wallet needed." },
  { icon: PenLine, title: "Sign", detail: "Exact amounts from one block, one transaction in." },
  { icon: SlidersHorizontal, title: "Manage", detail: "Stake, claim, exit, or unwind your Trove." },
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
      <p className="inline-flex rounded-full px-3 py-1 ring-1 ring-inset ring-line">
        <span className="eyebrow">How it works</span>
      </p>
      <h2 id="how-heading" className="mt-4 text-headline text-ink">
        Plan, sign, manage
      </h2>
      <div aria-hidden className="relative mt-8 hidden h-px bg-line sm:block">
        <span data-seen={seen} className="landing-fill absolute inset-0 origin-left bg-accent" />
      </div>
      <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, detail }) => (
          <li key={title}>
            <p className="flex items-center gap-3 text-base font-semibold text-ink">
              <span className="landing-trust-icon text-accent">
                <Icon aria-hidden className="h-4 w-4" />
              </span>
              {title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
