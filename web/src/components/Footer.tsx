"use client";

import { useNetwork } from "@/lib/config/network-context";
import { explorerAddressUrl } from "@/lib/config/networks";

const REPOSITORY = "https://github.com/hms1499/MezoRoute";

export function Footer() {
  const { network } = useNetwork();
  const link = "hover:text-accent hover:underline";
  return (
    <footer className="mt-12 w-full border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted sm:px-6">
        <p>Unaudited software.{network.id === "testnet" ? " Testnet tokens have no value." : ""}</p>
        <nav aria-label="Project links" className="flex gap-4">
          {network.executor && (
            <a
              href={explorerAddressUrl(network, network.executor.address)}
              target="_blank"
              rel="noreferrer"
              className={link}
            >
              Executor contract
            </a>
          )}
          <a href={REPOSITORY} target="_blank" rel="noreferrer" className={link}>
            Source code
          </a>
        </nav>
      </div>
    </footer>
  );
}
