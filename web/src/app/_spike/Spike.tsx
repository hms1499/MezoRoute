"use client";

import { EnterPanel } from "./EnterPanel";
import { WalletInfo } from "./WalletInfo";

export default function Spike() {
  return (
    <div className="space-y-6">
      <WalletInfo />
      <EnterPanel />
    </div>
  );
}
