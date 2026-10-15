"use client";

import { useNetwork } from "@/lib/config/network-context";
import { explorerAddressUrl } from "@/lib/config/networks";
import { useSurface } from "./surface";

const REPOSITORY = "https://github.com/hms1499/MezoRoute";

export function Footer() {
  const { network } = useNetwork();
  const dark = useSurface() === "dark";
  const link = dark ? "hover:text-night-lp hover:underline" : "hover:text-accent hover:underline";
  return (
    <footer
      className={`mt-12 flex flex-wrap items-center justify-between gap-3 border-t py-6 text-xs ${dark ? "border-night-line text-night-muted" : "border-line text-muted"}`}
    >
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
    </footer>
  );
}
