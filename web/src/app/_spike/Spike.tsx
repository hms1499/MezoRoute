"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletInfo } from "./WalletInfo";

export default function Spike() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">MezoRoute · S1 spike</h1>
        <ConnectButton />
      </header>
      <WalletInfo />
    </main>
  );
}
