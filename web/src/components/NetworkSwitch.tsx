"use client";

import { useNetwork } from "@/lib/config/network-context";
import type { NetworkId } from "@/lib/config/networks";
import { useSurface } from "./surface";

const OPTIONS: { id: NetworkId; label: string }[] = [
  { id: "testnet", label: "Testnet" },
  { id: "mainnet", label: "Mainnet" },
];

/** Segmented Testnet | Mainnet control; choosing the other network stores it and reloads the page. */
export function NetworkSwitch() {
  const { network, switchNetwork } = useNetwork();
  const dark = useSurface() === "dark";
  return (
    <div role="radiogroup" aria-label="Network" className={dark ? "flex rounded-full bg-night-panel p-0.5 text-xs" : "flex rounded-full bg-line p-0.5 text-xs"}>
      {OPTIONS.map((option) => {
        const active = option.id === network.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => switchNetwork(option.id)}
            className={
              active
                ? dark
                  ? "rounded-full bg-night-line px-2.5 py-1.5 font-semibold text-night-lp sm:px-3"
                  : "rounded-full bg-white px-2.5 py-1.5 font-semibold text-accent shadow-sm sm:px-3"
                : dark
                  ? "rounded-full px-2.5 py-1.5 text-night-muted hover:text-night-ink sm:px-3"
                  : "rounded-full px-2.5 py-1.5 text-muted hover:text-ink sm:px-3"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
