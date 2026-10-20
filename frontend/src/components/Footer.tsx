"use client";

import { LogoMark } from "@/components/ui/Logo";
import { MEZO_SITE, REPOSITORY } from "@/lib/config/links";
import { useNetwork } from "@/lib/config/network-context";
import { explorerAddressUrl } from "@/lib/config/networks";
import { ThemeSwitch } from "./ThemeToggle";

/** Brand and project links on top, the standing disclaimer underneath; the hairlines span the viewport. */
export function Footer() {
  const { network } = useNetwork();
  const link = "rounded hover:text-accent hover:underline underline-offset-4";
  return (
    <footer className="mt-12 w-full border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-6 py-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <LogoMark className="h-6 w-6" />
              MezoRoute
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Compare the MUSD/BTC pool and the Stability Pool on Mezo, then enter and exit in MUSD.
            </p>
          </div>
          <nav aria-label="Project links" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {network.executor && (
              <a href={explorerAddressUrl(network, network.executor.address)} target="_blank" rel="noreferrer" className={link}>
                Executor contract
              </a>
            )}
            <a href={REPOSITORY} target="_blank" rel="noreferrer" className={link}>
              Source code
            </a>
            <a href={MEZO_SITE} target="_blank" rel="noreferrer" className={link}>
              Mezo
            </a>
          </nav>
          {/* Below 768 px the header has no room for the theme toggle (U9). */}
          <ThemeSwitch />
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-muted sm:px-6">
          Unaudited software.{network.id === "testnet" ? " Testnet tokens have no value." : ""}
        </p>
      </div>
    </footer>
  );
}
