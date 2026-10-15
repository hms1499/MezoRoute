"use client";

import { useNetwork } from "@/lib/config/network-context";
import { explorerAddressUrl } from "@/lib/config/networks";

const REPOSITORY = "https://github.com/hms1499/MezoRoute";

export function Footer() {
  const { network } = useNetwork();
  return (
    <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line py-6 text-xs text-muted">
      <p>Unaudited software.{network.id === "testnet" ? " Testnet tokens have no value." : ""}</p>
      <nav aria-label="Project links" className="flex gap-4">
        {network.executor && (
          <a
            href={explorerAddressUrl(network, network.executor.address)}
            target="_blank"
            rel="noreferrer"
            className="hover:text-accent hover:underline"
          >
            Executor contract
          </a>
        )}
        <a href={REPOSITORY} target="_blank" rel="noreferrer" className="hover:text-accent hover:underline">
          Source code
        </a>
      </nav>
    </footer>
  );
}
