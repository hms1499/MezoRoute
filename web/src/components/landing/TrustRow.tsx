"use client";

import { BadgeCheck, Lock, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { explorerAddressUrl, networks } from "@/lib/config/networks";
import { useInView } from "./hooks";

const executor = networks.mainnet.executor;

export function TrustRow() {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} data-seen={seen} aria-labelledby="trust-heading" className="landing-section landing-reveal">
      <h2 id="trust-heading" className="landing-section-title text-2xl tracking-tight">
        Before you connect
      </h2>
      <ul className="mt-6 grid grid-cols-1 gap-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Item icon={Lock} title="Non-custodial">
          Funds never sit in MezoRoute between transactions.
        </Item>
        <Item icon={BadgeCheck} title="Source-verified">
          {executor ? (
            <a href={explorerAddressUrl(networks.mainnet, executor.address)} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-night-lp">
              Executor on the Mezo explorer
            </a>
          ) : (
            "Executor source on the Mezo explorer"
          )}
          , no admin keys.
        </Item>
        <Item icon={ShieldCheck} title="Capped">
          Max 1,000 MUSD per transaction on mainnet.
        </Item>
        <Item icon={TriangleAlert} title="Unaudited" warn>
          Hackathon software. Use small amounts.
        </Item>
      </ul>
    </section>
  );
}

function Item({ icon: Icon, title, warn = false, children }: { icon: LucideIcon; title: string; warn?: boolean; children: ReactNode }) {
  return (
    <li>
      <p className={warn ? "flex items-center gap-2 font-semibold text-warning-ink" : "flex items-center gap-2 font-semibold text-night-ink"}>
        <span className="landing-trust-icon">
          <Icon aria-hidden className="h-4 w-4" />
        </span>
        {title}
      </p>
      <p className="mt-1 leading-relaxed text-night-muted">{children}</p>
    </li>
  );
}
