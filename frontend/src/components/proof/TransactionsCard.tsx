"use client";

import { useState } from "react";
import { CopyAction } from "@/components/ui/IconAction";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { explorerTxUrl, type NetworkConfig } from "@/lib/config/networks";
import { shortAddress } from "@/lib/format";
import type { ProofRow } from "@/lib/proof/rows";
import { PROOF_LINK, utcTime } from "./format";

// U19 §3.2 item 4: every action, newest first, 10 at a time. Built from events, so relayed Bitcoin-wallet calls show.

const FIRST = 10;
const SUBTITLE =
  "Calls to MezoRoute's contracts, newest first. Each wallet is labelled team or outside. Calls straight to Mezo's own contracts (Stability Pool deposits, gauge claims) don't go through MezoRoute and aren't listed.";

export function TransactionsCard({
  network,
  rows,
  error,
  onRetry,
}: {
  network: NetworkConfig;
  rows: ProofRow[] | undefined;
  error: Error | null;
  onRetry: () => void;
}) {
  const [all, setAll] = useState(false);
  const columns: DataColumn<ProofRow>[] = [
    { key: "action", header: "Action", align: "left", cell: (r) => <span className="font-medium">{r.label}</span> },
    { key: "when", header: "When (UTC)", align: "left", cell: (r) => utcTime(r.time) },
    { key: "result", header: "Result", align: "left", cell: (r) => r.result },
    { key: "contract", header: "Contract", align: "left", cell: (r) => <span className="text-muted">{r.contract}</span> },
    {
      key: "wallet",
      header: "Wallet",
      align: "left",
      cell: (r) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2">
            {shortAddress(r.wallet)}
            <CopyAction value={r.wallet} what="wallet address" text="sm" />
          </span>
          <Badge tone={r.walletKind === "outside" ? "accent" : "neutral"}>{r.walletKind}</Badge>
        </span>
      ),
    },
    {
      key: "tx",
      header: "Transaction",
      align: "left",
      cell: (r) => (
        <a href={explorerTxUrl(network, r.txHash)} target="_blank" rel="noreferrer" className={PROOF_LINK}>
          {shortAddress(r.txHash)}
        </a>
      ),
    },
  ];
  const shown = rows && !all ? rows.slice(0, FIRST) : rows;
  return (
    <Card title="Every transaction" subtitle={SUBTITLE}>
      <div className="mt-4">
        {error ? (
          <Notice
            action={
              <Button size="md" variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            }
          >
            The transaction list could not be read from the explorer right now.
          </Notice>
        ) : !shown ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading transactions">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <>
            <DataTable caption={`Calls to MezoRoute's contracts on ${network.name}`} columns={columns} rows={shown} empty="No transactions yet." rowKey={(r) => r.key} />
            {rows && rows.length > FIRST && !all && (
              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
                <span>
                  Showing {FIRST} of {rows.length}
                </span>
                <Button size="md" variant="secondary" onClick={() => setAll(true)}>
                  Show all {rows.length}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
