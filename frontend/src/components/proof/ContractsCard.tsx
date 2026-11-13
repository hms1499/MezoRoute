import { Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CopyAction } from "@/components/ui/IconAction";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Notice } from "@/components/ui/Notice";
import { explorerAddressUrl, explorerTxUrl, type NetworkConfig } from "@/lib/config/networks";
import { shortAddress } from "@/lib/format";
import type { ProofContract } from "@/lib/proof/contracts";
import { deployDate, PROOF_LINK } from "./format";

// U19 §3.2 item 3: the contracts, their deployment, terms, and source. Verified is a constant: all three are verified
// on both explorers and immutable; the link lets anyone check.

const UNAUDITED =
  "No outside audit or review yet; use small amounts. Leverage, Unwind, and Close have run end to end on testnet only; on mainnet they are deployed and capped but not yet run.";

export function ContractsCard({ network, contracts }: { network: NetworkConfig; contracts: ProofContract[] }) {
  const columns: DataColumn<ProofContract>[] = [
    {
      key: "contract",
      header: "Contract",
      align: "left",
      cell: (c) => (
        <span>
          <span className="font-semibold">{c.name}</span>
          <span className="block text-xs text-muted">{c.role}</span>
        </span>
      ),
    },
    {
      key: "address",
      header: "Address",
      align: "left",
      cell: (c) => (
        <span className="inline-flex items-center gap-2">
          <a href={explorerAddressUrl(network, c.address)} target="_blank" rel="noreferrer" className={PROOF_LINK}>
            {shortAddress(c.address)}
          </a>
          <CopyAction value={c.address} what="address" text="sm" />
        </span>
      ),
    },
    {
      key: "deployed",
      header: "Deployed",
      align: "left",
      cell: (c) => (
        <a href={explorerTxUrl(network, c.deployTx)} target="_blank" rel="noreferrer" className="hover:text-accent">
          {deployDate(c.deployedAt)}
          <span className="block text-xs text-muted">block {c.deployBlock.toLocaleString("en-US")}</span>
        </a>
      ),
    },
    { key: "terms", header: "Fee · cap per transaction", align: "left", cell: (c) => c.terms },
    {
      key: "source",
      header: "Source",
      align: "left",
      cell: (c) => (
        <a href={`${explorerAddressUrl(network, c.address)}?tab=contract`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-positive hover:underline">
          <Check aria-hidden className="h-4 w-4" />
          Verified
        </a>
      ),
    },
  ];
  return (
    <Card title="Contracts" subtitle="Immutable: no owner, no proxy, no pause. Fees and caps are fixed at deploy.">
      <div className="mt-4">
        <DataTable caption={`MezoRoute contracts on ${network.name}`} columns={columns} rows={contracts} empty="No contracts on this network." rowKey={(c) => c.address} />
      </div>
      <Notice tone="warning" className="mt-4">
        <span className="font-semibold">Unaudited.</span> {UNAUDITED}
        {network.id === "testnet" ? " Testnet tokens have no value." : ""}
      </Notice>
    </Card>
  );
}
