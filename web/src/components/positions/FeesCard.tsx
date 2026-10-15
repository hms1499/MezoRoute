"use client";

import type { Address } from "viem";
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
    <section className="card">
      <h2 className="font-semibold">Pool fees earned</h2>
      <p className="mt-1 text-xs text-muted">The pool pays its trading fees to LP holders when they claim. Claiming does not touch your LP.</p>
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
        <button
          type="button"
          disabled={block !== null || pending}
          onClick={claim}
          className="ml-auto rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {pending ? "Check your wallet…" : "Claim"}
        </button>
      </div>
    </section>
  );
}
