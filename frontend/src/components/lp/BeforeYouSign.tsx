import { Card } from "@/components/ui/Card";
import { REPOSITORY } from "@/lib/config/links";
import { explorerAddressUrl, type NetworkConfig } from "@/lib/config/networks";
import { formatBps, formatToken, shortAddress } from "@/lib/format";

// U13 §Before you sign: what a visitor gives up the moment they connect and sign, before they have a wallet open.
// The fee is the chain's value (not the pinned config), and the block is the one every figure on the page came from.

const LINK = "font-medium text-accent underline underline-offset-2 hover:text-accent-hover";

export function BeforeYouSign({
  network,
  feeBps,
  capMusd,
  blockNumber,
}: {
  network: NetworkConfig;
  feeBps: bigint;
  capMusd: bigint;
  blockNumber: bigint;
}) {
  const executor = network.executor;
  if (!executor) return null;
  return (
    <Card title="Before you sign">
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted">Executor</dt>
          <dd>
            <a href={explorerAddressUrl(network, executor.address)} target="_blank" rel="noreferrer" className={LINK}>
              {shortAddress(executor.address)}
            </a>
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted">MezoRoute fee</dt>
          <dd>{formatBps(feeBps)}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted">Entry cap</dt>
          <dd>{formatToken(capMusd, 18, 0)} MUSD</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted">Audit</dt>
          <dd>
            <a href={REPOSITORY} target="_blank" rel="noreferrer" className={LINK}>
              Unaudited software
            </a>
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted">Reads</dt>
          <dd>Block {formatToken(blockNumber, 0, 0)}</dd>
        </div>
      </dl>
    </Card>
  );
}
