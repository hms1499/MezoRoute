import { BlockNotice } from "@/components/lp/BlockNotice";
import { btc } from "@/components/lp/units";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { SpBlock } from "@/lib/stability-pool/gate";
import type { Pending } from "@/lib/ui/pending";

/**
 * U14 B6: no deposit left but a BTC gain waiting. Claim is the page's primary; when the gate blocks it (no BTC for
 * gas, the wrong network, a read-only network) the reason sits under the button instead of leaving it silent.
 */
export function SpGainOnlyCard({
  gain,
  claimBlock,
  busy,
  pending,
  onClaim,
}: {
  gain: bigint;
  claimBlock: SpBlock | null;
  busy: boolean;
  pending: Pending | null;
  onClaim: () => void;
}) {
  return (
    <Card title="No MUSD left in your deposit" subtitle={`A BTC gain of ${btc(gain)} is still waiting.`}>
      <div className="mt-4 space-y-3">
        <Button disabled={claimBlock !== null || busy} pending={pending} onClick={onClaim}>
          Claim BTC gain
        </Button>
        <BlockNotice block={claimBlock} />
      </div>
    </Card>
  );
}
