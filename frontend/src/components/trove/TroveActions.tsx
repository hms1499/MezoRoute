"use client";

import type { Address } from "viem";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { useNetwork } from "@/lib/config/network-context";
import { formatToken } from "@/lib/format";
import { RECOVERY_MODE_BLOCK, SURPLUS_CLAIM } from "@/lib/leverage/copy";
import { redemptionQueue } from "@/lib/leverage/queue";
import { useDirectTroveCall } from "@/lib/leverage/useDirectTroveCall";
import { useTroveSnapshot } from "@/lib/leverage/useTroveSnapshot";
import { GAS_COMPENSATION, MIN_NET_DEBT } from "@/lib/trove/constants";
import { QueueLine } from "./TroveViews";

/**
 * The Trove card's L1 part: Unwind / Close / Leverage (or Open with leverage without a Trove), the
 * redemption queue, the surplus-BTC claim, and in Recovery Mode the way out (Repay from wallet).
 */
export function TroveActions({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { data, queue } = useTroveSnapshot(account);
  const direct = useDirectTroveCall(account);
  if (!network.leverage || !data) return null;
  const s = data.snapshot;
  const position = queue && s.trove ? redemptionQueue(queue, account, null, s.market.mcr) : null;
  const maxRepay = s.trove ? s.trove.debt - MIN_NET_DEBT - GAS_COMPENSATION : 0n;
  const repay = s.walletMusd < maxRepay ? s.walletMusd : maxRepay;
  return (
    <div className="mt-4 space-y-4">
      {s.surplusBtc > 0n && (
        <Notice
          tone="success"
          role="status"
          action={
            <Button size="md" variant="secondary" pending={direct.pending === "claim" ? "busy" : null} onClick={() => direct.run({ kind: "claim" })}>
              Claim {formatToken(s.surplusBtc)} BTC
            </Button>
          }
        >
          {SURPLUS_CLAIM}
        </Notice>
      )}
      {s.trove && s.recoveryMode && (
        <Notice
          tone="warning"
          role="status"
          action={
            repay > 0n && (
              <Button
                size="md"
                variant="secondary"
                pending={direct.pending === "repay" ? "busy" : null}
                onClick={() => direct.run({ kind: "repay", amount: repay, trove: s.trove!, troveCount: s.system.troveCount })}
              >
                Repay {formatToken(repay, 18, 2)} MUSD from wallet
              </Button>
            )
          }
        >
          {RECOVERY_MODE_BLOCK}
        </Notice>
      )}
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
        ) : null}
      </div>
    </div>
  );
}
