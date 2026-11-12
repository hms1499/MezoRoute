import { BeforeYouSign } from "@/components/flow/BeforeYouSign";
import { Overview } from "@/components/flow/Overview";
import { Card } from "@/components/ui/Card";
import type { SignFact } from "@/lib/flow/sign-facts";
import { spDepositRows } from "@/lib/stability-pool/position";

/** The Stability Pool pages' aside (U14): the deposit the page already read, when there is one, then Before you sign. */
export function SpDepositAside({ sp, facts, musdDecimals }: { sp: { deposit: bigint; btcGain: bigint }; facts: SignFact[] | null; musdDecimals?: number }) {
  const rows = spDepositRows(sp, musdDecimals);
  return (
    <>
      {rows && (
        <Card title="Your deposit">
          <Overview rows={rows} className="mt-3" />
        </Card>
      )}
      <BeforeYouSign facts={facts} />
    </>
  );
}
