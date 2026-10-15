"use client";

import { BadgeCheck, Layers, LifeBuoy, Lock, ShieldCheck, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { useNetwork } from "@/lib/config/network-context";
import { explorerAddressUrl } from "@/lib/config/networks";
import { LP_RETURN_SOURCE, LP_RISKS, SP_RETURN_SOURCE, SP_RISKS } from "@/lib/routes/copy";
import { ConnectCta } from "./ConnectCta";
import { LiveCard } from "./LiveCard";

const STEPS = [
  {
    title: "Compare routes",
    detail: "Both routes for the same amount: where the return comes from, fees, BTC exposure, and the last 30 days on chain.",
  },
  {
    title: "Preview the exact transaction",
    detail: "Amounts, minimums, fees, and your BTC exposure before and after, read from one block before you sign.",
  },
  {
    title: "Sign, and exit to MUSD",
    detail: "One transaction to enter and one to exit. Stability Pool withdrawals pause while any Trove is under-collateralised.",
  },
];

/** The first screen before a wallet connects (U1 §3). */
export function Landing() {
  const { network } = useNetwork();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-14 py-4 lg:py-10">
      <section className="grid items-center gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        <div>
          <Badge tone="accent">{network.name}</Badge>
          <h1 className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-tight [text-wrap:balance] sm:text-4xl">
            Put your MUSD to work, and see what it does to your BTC risk.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
            Compare the MUSD/BTC pool with the Stability Pool, preview the exact transaction before you sign, and exit back
            to MUSD. MezoRoute never holds your funds between transactions.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ConnectCta />
            <a href="#how-it-works" className={buttonClass("ghost")}>
              How it works
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <Trust icon={Lock}>Non-custodial</Trust>
            {network.executor && (
              <Trust icon={BadgeCheck}>
                <a
                  href={explorerAddressUrl(network, network.executor.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-accent"
                >
                  Source-verified contract
                </a>
              </Trust>
            )}
            <Trust icon={ShieldCheck}>Max 1,000 MUSD per transaction on mainnet</Trust>
          </ul>
        </div>
        <LiveCard />
      </section>

      <section aria-labelledby="routes-heading">
        <h2 id="routes-heading" className="text-xl font-semibold tracking-tight">
          Two routes for your MUSD
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <RouteCard icon={Layers} title="MUSD/BTC LP" tagline="Earn swap fees" source={LP_RETURN_SOURCE} risk={LP_RISKS[0]} />
          <RouteCard icon={LifeBuoy} title="Stability Pool" tagline="Back the system" source={SP_RETURN_SOURCE} risk={SP_RISKS[0]} />
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-6">
        <h2 id="how-heading" className="text-xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="card">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                {index + 1}
              </span>
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Trust({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <Icon aria-hidden className="h-4 w-4 text-accent" />
      {children}
    </li>
  );
}

function RouteCard({ icon: Icon, title, tagline, source, risk }: { icon: LucideIcon; title: string; tagline: string; source: string; risk: string }) {
  return (
    <article className="card">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted">{tagline}</p>
        </div>
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Return source</dt>
          <dd>{source}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Main risk</dt>
          <dd>{risk}</dd>
        </div>
      </dl>
    </article>
  );
}
