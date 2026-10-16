"use client";

import { LP_RETURN_SOURCE, LP_RISKS, SP_RETURN_SOURCE, SP_RISKS } from "@/lib/routes/copy";
import { cx } from "@/lib/ui/cx";
import { useInView } from "./hooks";
import type { Highlight } from "./Landing";

export function RouteLanes({ onHighlight }: { onHighlight: (highlight: Highlight) => void }) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} data-seen={seen} aria-labelledby="routes-heading" className="landing-reveal border-t border-night-line py-14">
      <h2 id="routes-heading" className="text-2xl font-semibold tracking-tight text-night-ink">
        Where your MUSD goes, and what it does to your BTC
      </h2>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Lane
          route="lp"
          label="MUSD/BTC LP"
          title="Earn swap fees"
          source={LP_RETURN_SOURCE}
          risk={LP_RISKS[0]}
          txs="One transaction in, after a permit or approval; one transaction out, back to MUSD."
          onHighlight={onHighlight}
        />
        <Lane
          route="sp"
          label="Stability Pool"
          title="Back the system"
          source={SP_RETURN_SOURCE}
          risk={SP_RISKS[0]}
          txs="Approve, then deposit; withdraw to exit."
          onHighlight={onHighlight}
        />
      </div>
    </section>
  );
}

function Lane(props: {
  route: "lp" | "sp";
  label: string;
  title: string;
  source: string;
  risk: string;
  txs: string;
  onHighlight: (highlight: Highlight) => void;
}) {
  const lp = props.route === "lp";
  return (
    <article
      onMouseEnter={() => props.onHighlight(props.route)}
      onMouseLeave={() => props.onHighlight(null)}
      className={cx(
        "rounded-2xl border border-line bg-surface p-5 transition-colors duration-200",
        lp ? "hover:border-accent" : "hover:border-sp",
      )}
    >
      <p className={cx("inline-flex items-center gap-2 text-sm font-medium", lp ? "text-accent" : "text-sp")}>
        <span aria-hidden className={cx("h-2 w-2 rounded-full", lp ? "bg-accent" : "bg-sp")} />
        {props.label}
      </p>
      <h3 className="mt-1.5 text-lg font-semibold text-night-ink">{props.title}</h3>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-night-muted">Return source</dt>
          <dd className="text-night-ink">{props.source}</dd>
        </div>
        <div>
          <dt className="text-xs text-night-muted">Main risk</dt>
          <dd className="text-night-ink">{props.risk}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-night-muted">{props.txs}</p>
    </article>
  );
}
