"use client";

import { ButtonContent, buttonClass } from "@/components/ui/Button";
import type { RouteSectionCopy } from "@/lib/landing/sections";
import { cx } from "@/lib/ui/cx";
import { useInView } from "./hooks";
import type { Highlight } from "./Landing";
import { LpIllustration } from "./LpIllustration";
import { SpIllustration } from "./SpIllustration";

const CORNERS = ["-left-[5px] -top-[5px]", "-right-[5px] -top-[5px]", "-bottom-[5px] -left-[5px]", "-bottom-[5px] -right-[5px]"];

/**
 * One route in morpho.org's rhythm (U10): pill, heading, paragraph, button; the illustration on the side the copy
 * names (text first below 768 px). Hovering or focusing it highlights that route in the simulator's chart.
 */
export function RouteSection({ copy, onHighlight }: { copy: RouteSectionCopy; onHighlight: (highlight: Highlight) => void }) {
  const [ref, seen] = useInView<HTMLElement>();
  const lp = copy.route === "lp";
  const left = copy.illustration === "left";
  return (
    <section
      ref={ref}
      data-seen={seen}
      aria-labelledby={`route-${copy.route}-heading`}
      onMouseEnter={() => onHighlight(copy.route)}
      onMouseLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(copy.route)}
      onBlur={() => onHighlight(null)}
      className="landing-section landing-reveal grid grid-cols-1 items-center gap-10 md:grid-cols-2 lg:gap-16"
    >
      <div className={cx("min-w-0", left && "md:order-2")}>
        <p className="inline-flex rounded-full px-3 py-1 ring-1 ring-inset ring-line">
          <span className={cx("eyebrow", lp ? "text-accent" : "text-sp")}>{copy.pill}</span>
        </p>
        <h2 id={`route-${copy.route}-heading`} className="mt-4 text-headline text-ink">
          {copy.title}
        </h2>
        <div className="mt-3 space-y-2 text-base leading-relaxed text-muted">
          {copy.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">{copy.txs}</p>
        <a href="#simulator" className={buttonClass("secondary", "md", "mt-6", true)}>
          <ButtonContent variant="secondary" arrow>
            Compare routes
          </ButtonContent>
        </a>
      </div>
      <div className={cx("landing-frame relative min-w-0 p-6 sm:p-10", left && "md:order-1")}>
        {CORNERS.map((corner) => (
          <span key={corner} aria-hidden className={`frame-cross ${corner}`} />
        ))}
        {lp ? <LpIllustration /> : <SpIllustration />}
      </div>
    </section>
  );
}
