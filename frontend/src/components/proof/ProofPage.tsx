"use client";

import { useEffect, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { networks, type NetworkId } from "@/lib/config/networks";
import { proofContracts } from "@/lib/proof/contracts";
import { useHeadBlock, useProof } from "@/lib/proof/useProof";
import { ContractsCard } from "./ContractsCard";
import { TransactionsCard } from "./TransactionsCard";

// U19 §3: every MezoRoute contract and every call to it, on either network, read live and without a wallet. The
// Mainnet | Testnet switch is the page's own; it never changes the app's network.

const SUBTITLE = "Every MezoRoute contract and every transaction it has run, read from Mezo as this page loaded. No wallet needed. Each row opens the explorer.";

export default function ProofPage() {
  const [id, setId] = useState<NetworkId>("mainnet");
  const network = networks[id];
  const { rows, error, retry } = useProof(network);
  const head = useHeadBlock(network);
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-title">Proof</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">{SUBTITLE}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Network"
          options={[
            { value: "mainnet", label: "Mainnet" },
            { value: "testnet", label: "Testnet" },
          ]}
          value={id}
          onChange={setId}
        />
        {head.block && (
          <HeadLine
            number={head.block.number}
            readAt={head.block.readAt}
            onRefresh={() => {
              head.refresh();
              retry();
            }}
          />
        )}
      </div>
      <ContractsCard network={network} contracts={proofContracts(network)} />
      <TransactionsCard key={id} network={network} rows={rows} error={error} onRetry={retry} />
    </div>
  );
}

function HeadLine({ number, readAt, onRefresh }: { number: bigint; readAt: number; onRefresh: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.round((now - readAt) / 1000));
  return (
    <p className="flex items-center gap-2 text-xs text-muted">
      <span aria-hidden className="h-2 w-2 rounded-full bg-positive" />
      Block {number.toLocaleString("en-US")} · read {seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)} min`} ago ·
      <button type="button" onClick={onRefresh} className="hit rounded-tip font-medium text-accent underline underline-offset-2 hover:text-accent-hover">
        Refresh
      </button>
    </p>
  );
}
