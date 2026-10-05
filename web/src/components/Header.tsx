"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { NetworkSwitch } from "./NetworkSwitch";

/** Shared header (spec §9): logo, Testnet/Mainnet switch, Passport wallet button. */
export function Header() {
  return (
    <header className="flex items-center justify-between gap-3 py-4">
      <Link href="/" aria-label="MezoRoute home" className="flex items-center gap-2 text-base font-bold">
        <span aria-hidden className="h-5 w-5 rounded-md bg-accent" />
        <span className="hidden sm:inline">MezoRoute</span>
      </Link>
      <NetworkSwitch />
      <ConnectButton
        label="Connect"
        chainStatus="none"
        showBalance={false}
        accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
      />
    </header>
  );
}
