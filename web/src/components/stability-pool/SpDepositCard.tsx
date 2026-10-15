import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { btc, musd } from "@/components/lp/units";
import type { SpDepositPreview } from "@/lib/stability-pool/preview";

/** What the deposit does (Flow E step 1): estimated until the receipt. */
export function SpDepositCard({ preview }: { preview: SpDepositPreview }) {
  return (
    <Card title="Review your deposit" headingLevel={1}>
      <dl className="mt-3 stat-list">
        <Stat label="Your deposit now">{musd(preview.depositNow)}</Stat>
        <Stat label="Pending BTC gain" sub="Paid to your wallet with this deposit">
          {btc(preview.gainPaid)}
        </Stat>
        {preview.depositAfter !== null && (
          <Stat label="Deposit after (estimated)" strong>
            {musd(preview.depositAfter)}
          </Stat>
        )}
        <Stat label="MezoRoute fee">None (direct protocol call)</Stat>
        <Stat label="Network fee (estimated)">{preview.gasCost === null ? "—" : btc(preview.gasCost)}</Stat>
      </dl>
    </Card>
  );
}
