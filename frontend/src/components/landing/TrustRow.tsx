"use client";

import { BadgeCheck, Lock, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { explorerAddressUrl, networks } from "@/lib/config/networks";
import { contractLinks, mainnetCaps } from "@/lib/landing/caps";
import { useInView } from "./hooks";

const mainnet = networks.mainnet;

export function TrustRow() {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} data-seen={seen} aria-labelledby="trust-heading" className="landing-section landing-reveal">
      <p className="inline-flex rounded-full px-3 py-1 ring-1 ring-inset ring-line">
        <span className="eyebrow">Safety</span>
      </p>
      <h2 id="trust-heading" className="mt-4 text-headline text-ink">
        Before you connect
      </h2>
      <ul className="mt-6 grid grid-cols-1 gap-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Item icon={Lock} title="Non-custodial">
          Funds never rest in MezoRoute.
        </Item>
        <Item icon={BadgeCheck} title="Source-verified">
          {contractLinks(mainnet).map((contract, index) => (
            <span key={contract.address}>
              {index > 0 && " · "}
              <a href={explorerAddressUrl(mainnet, contract.address)} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-night-lp">
                {contract.label.replace(" contract", "")}
              </a>
            </span>
          ))}
          . No admin keys.
        </Item>
        <Item icon={ShieldCheck} title="Capped on mainnet">
          {mainnetCaps(mainnet)}.
        </Item>
        <Item icon={TriangleAlert} title="Unaudited" warn>
          Use small amounts. Trove actions have not yet run end to end on mainnet.
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
