"use client";

import type { Address } from "viem";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { btc, musd } from "@/components/lp/units";
import type { ClaimBlock } from "@/lib/positions/claim";
import { useClaimFees } from "@/lib/positions/useClaimFees";
import type { FeesView } from "@/lib/positions/view";

/** Flow G2: the pool's swap fees owed to this account, paid only when it calls claimFees(). */
export function FeesCard({ account, fees, block }: { account: Address; fees: FeesView; block: ClaimBlock | null }) {
  const { claim, pending } = useClaimFees(account);
  return (
    <Card title="Pool fees earned" subtitle="The pool pays its trading fees to LP holders when they claim. Claiming does not touch your LP.">
      <dl className="mt-3 stat-list">
        <Stat label="MUSD">{musd(fees.musd)}</Stat>
        <Stat label="BTC" sub={`≈ ${musd(fees.btcValue)}`}>
          {btc(fees.btc)}
        </Stat>
        <Stat label="Total (estimated)" strong>
          {musd(fees.total)}
        </Stat>
      </dl>
      <div className="mt-4 flex items-center justify-between gap-3">
        <BlockNotice block={block} />
        <Button disabled={block !== null} loading={pending} onClick={claim} className="ml-auto">
          {pending ? "Check your wallet…" : "Claim fees"}
        </Button>
      </div>
    </Card>
  );
}
