"use client";

import type { Address } from "viem";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { formatToken } from "@/lib/format";
import { RECOVERY_MODE_BLOCK, SURPLUS_CLAIM } from "@/lib/leverage/copy";
import type { TroveSnapshot } from "@/lib/leverage/snapshot";
import { useDirectTroveCall } from "@/lib/leverage/useDirectTroveCall";
import { GAS_COMPENSATION, MIN_NET_DEBT } from "@/lib/trove/constants";

/**
 * The Trove notices that need action now (U20: on the Dashboard card and on /trove/): the surplus-BTC claim after a
 * redemption or liquidation closed the Trove, and in Recovery Mode the way out (Repay from wallet).
 */
export function TroveNotices({ account, snapshot, className }: { account: Address; snapshot: TroveSnapshot; className?: string }) {
  const direct = useDirectTroveCall(account);
  const s = snapshot;
  const maxRepay = s.trove ? s.trove.debt - MIN_NET_DEBT - GAS_COMPENSATION : 0n;
  const repay = s.walletMusd < maxRepay ? s.walletMusd : maxRepay;
  const surplus = s.surplusBtc > 0n;
  const recovery = s.trove !== null && s.recoveryMode;
  if (!surplus && !recovery) return null;
  return (
    <div className={className ?? "space-y-4"}>
      {surplus && (
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
      {recovery && (
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
    </div>
  );
}
