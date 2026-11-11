"use client";

import { Gauge, LogOut, PenLine, TriangleAlert, Wallet, Zap, type LucideIcon } from "lucide-react";
import { ConnectCta } from "@/components/home/ConnectCta";
import { ButtonLink } from "@/components/ui/Button";
import { plannerHref } from "@/lib/landing/links";
import type { FactIcon, RouteSectionCopy } from "@/lib/landing/sections";
import { cx } from "@/lib/ui/cx";
import { useInView } from "./hooks";
import type { Highlight } from "./Landing";
import { LpIllustration } from "./LpIllustration";
import { SpIllustration } from "./SpIllustration";
import { TroveIllustration } from "./TroveIllustration";

const CORNERS = ["-left-[5px] -top-[5px]", "-right-[5px] -top-[5px]", "-bottom-[5px] -left-[5px]", "-bottom-[5px] -right-[5px]"];

const FACT_ICONS: Record<FactIcon, LucideIcon> = { tx: Zap, sign: PenLine, exit: LogOut, oracle: Gauge, wallet: Wallet };

const PILL_TONE = { lp: "text-accent", sp: "text-sp", trove: "text-ink" } as const;

/**
 * One section in morpho.org's rhythm (U10): pill, heading, one line, the risk, how it is sent as icon facts (U16), one
 * action; the illustration on the side the copy names (text first below 768 px). Hovering or focusing a route
 * highlights it in the simulator's chart (the chart has no Trove line).
 */
export function RouteSection({ copy, amount, onHighlight }: { copy: RouteSectionCopy; amount: bigint; onHighlight: (highlight: Highlight) => void }) {
  const [ref, seen] = useInView<HTMLElement>();
  const left = copy.illustration === "left";
  const highlight: Highlight = copy.route === "trove" ? null : copy.route;
  return (
    <section
      ref={ref}
      data-seen={seen}
      aria-labelledby={`route-${copy.route}-heading`}
      onMouseEnter={() => onHighlight(highlight)}
      onMouseLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(highlight)}
      onBlur={() => onHighlight(null)}
      className="landing-section landing-reveal grid grid-cols-1 items-center gap-10 md:grid-cols-2 lg:gap-16"
    >
      <div className={cx("min-w-0", left && "md:order-2")}>
        <p className="inline-flex rounded-full px-3 py-1 ring-1 ring-inset ring-line">
          <span className={cx("eyebrow", PILL_TONE[copy.route])}>{copy.pill}</span>
        </p>
        <h2 id={`route-${copy.route}-heading`} className="mt-4 text-headline text-ink">
          {copy.title}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted">{copy.body}</p>
        <p className="mt-3 flex gap-2 text-sm leading-relaxed text-muted">
          <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 flex-none text-warning-ink" />
          <span>
            <span className="sr-only">Risk: </span>
            {copy.risk}
          </span>
        </p>
        <ul aria-label="How it is sent" className="mt-4 flex flex-wrap gap-2">
          {copy.facts.map((fact) => {
            const Icon = FACT_ICONS[fact.icon];
            return (
              <li key={fact.text} className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-ink ring-1 ring-inset ring-line">
                <Icon aria-hidden className="h-3.5 w-3.5 text-accent" />
                {fact.text}
              </li>
            );
          })}
        </ul>
        <div className="mt-6">
          {copy.action.kind === "plan" ? (
            <ButtonLink href={plannerHref(copy.action.route, amount)} variant="secondary" className="bg-surface">
              {copy.action.label}
            </ButtonLink>
          ) : (
            <ConnectCta variant="nightOutline" label={copy.action.label} />
          )}
        </div>
      </div>
      <div className={cx("landing-frame relative min-w-0 p-6 sm:p-10", left && "md:order-1")}>
        {CORNERS.map((corner) => (
          <span key={corner} aria-hidden className={`frame-cross ${corner}`} />
        ))}
        {copy.route === "lp" ? <LpIllustration /> : copy.route === "sp" ? <SpIllustration /> : <TroveIllustration />}
      </div>
    </section>
  );
}
