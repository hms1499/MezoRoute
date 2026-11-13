"use client";

import type { Address } from "viem";
import { ButtonLink } from "@/components/ui/Button";
import { useNetwork } from "@/lib/config/network-context";
import { redemptionQueue } from "@/lib/leverage/queue";
import { useTroveSnapshot } from "@/lib/leverage/useTroveSnapshot";
import { TroveNotices } from "./TroveNotices";
import { QueueLine } from "./TroveViews";

/**
 * The Trove card's L1 part: Unwind / Close / Leverage (or Open with leverage without a Trove), the
 * redemption queue, the surplus-BTC claim, and in Recovery Mode the way out (Repay from wallet).
 */
export function TroveActions({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { data, queue } = useTroveSnapshot(account);
  if (!network.leverage || !data) return null;
  const s = data.snapshot;
  const position = queue && s.trove ? redemptionQueue(queue, account, null, s.market.mcr) : null;
  return (
    <div className="mt-4 space-y-4">
      <TroveNotices account={account} snapshot={s} />
      {position && <QueueLine before={position} after={null} />}
      <div className="flex flex-wrap gap-2">
        {s.trove ? (
          <>
            <ButtonLink href="/trove/unwind/" variant="secondary" size="md">
              Unwind
            </ButtonLink>
            <ButtonLink href="/trove/close/" variant="secondary" size="md">
              Close
            </ButtonLink>
            <ButtonLink href="/trove/leverage/" variant="secondary" size="md">
              Leverage
            </ButtonLink>
          </>
        ) : (
          <ButtonLink href="/trove/open/" variant="secondary" size="md">
            Open with leverage
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
