"use client";

import { Card } from "@/components/ui/Card";
import { ConnectCta } from "./ConnectCta";

/** Shown on route, confirm, receipt, and positions pages before a wallet connects. */
export function ConnectCard() {
  return (
    <Card title="Connect a wallet to continue" subtitle="MezoRoute reads your balances and positions to quote this page.">
      <div className="mt-4">
        <ConnectCta />
      </div>
    </Card>
  );
}
