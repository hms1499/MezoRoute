"use client";

import { LP_RETURN_SOURCE, LP_RISKS, SP_RETURN_SOURCE, SP_RISKS } from "@/lib/routes/copy";
import { cx } from "@/lib/ui/cx";
import { useInView } from "./hooks";
import type { Highlight } from "./Landing";

export function RouteLanes({ onHighlight }: { onHighlight: (highlight: Highlight) => void }) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} data-seen={seen} aria-labelledby="routes-heading" className="landing-reveal border-t border-night-line py-14">
      <p className="font-mono text-xs text-night-lp">{"// two routes"}</p>
      <h2 id="routes-heading" className="mt-2 text-2xl font-semibold tracking-tight text-night-ink">
        Where your MUSD goes, and what it does to your BTC
      </h2>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Lane
          route="lp"
          label="route_01 · MUSD/BTC LP"
          title="Earn swap fees"
          source={LP_RETURN_SOURCE}
          risk={LP_RISKS[0]}
          txs="enter: 1 tx (+ permit or approval) · exit: 1 tx → MUSD"
          onHighlight={onHighlight}
        />
        <Lane
          route="sp"
          label="route_02 · Stability Pool"
          title="Back the system"
          source={SP_RETURN_SOURCE}
          risk={SP_RISKS[0]}
          txs="enter: approve + deposit · exit: withdraw"
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
        "rounded-2xl border border-l-4 border-night-line bg-night-panel p-5 transition duration-200 hover:shadow-[0_18px_40px_rgba(0,0,0,0.35)] motion-safe:hover:-translate-y-0.5",
        lp ? "border-l-night-lp" : "border-l-night-sp",
      )}
    >
      <p className={cx("font-mono text-xs", lp ? "text-night-lp" : "text-night-sp")}>{props.label}</p>
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
      <p className="mt-4 font-mono text-xs text-night-muted">{props.txs}</p>
    </article>
  );
}
