"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetwork } from "@/lib/config/network-context";

export function ConnectHero() {
  const { network } = useNetwork();
  return (
    <section className="rounded-2xl bg-white p-6 shadow-card">
      <span className="rounded-full bg-line px-2.5 py-1 text-xs text-muted">{network.name}</span>
      <h1 className="mt-3 text-2xl font-semibold leading-tight">
        Put your MUSD to work, and see what it does to your BTC risk.
      </h1>
      <p className="mt-3 text-muted">
        Compare the MUSD/BTC pool with the Stability Pool, preview each transaction before you sign, and exit back to
        MUSD. MezoRoute never holds your funds between transactions.
      </p>
      <ConnectButton.Custom>
        {({ openConnectModal, mounted }) => (
          <button
            type="button"
            disabled={!mounted}
            onClick={openConnectModal}
            className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            Connect a Bitcoin or EVM wallet
          </button>
        )}
      </ConnectButton.Custom>
      <p className="mt-4 text-xs text-muted">
        Unaudited software.{network.id === "testnet" ? " Testnet tokens have no value." : ""}
      </p>
    </section>
  );
}
