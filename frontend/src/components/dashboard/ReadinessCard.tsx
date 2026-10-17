"use client";

import { useBitcoinAccount } from "@mezo-org/passport";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { useNetwork } from "@/lib/config/network-context";
import { writeBlocker, writeBlockerMessage } from "@/lib/config/write-gate";
import { readinessCopy, type Readiness, type ReadinessCopy } from "@/lib/dashboard/readiness";
import type { DashboardData } from "@/lib/dashboard/useDashboardSnapshot";
import { formatToken, shortAddress } from "@/lib/format";
import { isOrangeKitConnector, type WalletKind } from "@/lib/wallet/capabilities";
import { walletKindLabel, walletKindNote } from "@/lib/wallet/labels";

const BADGE_TONE: Record<ReadinessCopy["tone"], "accent" | "warning" | "neutral"> = {
  positive: "accent",
  attention: "warning",
  neutral: "neutral",
};

/** What the user can do now, plus the connected wallet in one line (replaces F1's wallet card). */
export function ReadinessCard({
  readiness,
  data,
  walletKind,
  account,
}: {
  readiness: Readiness;
  data: DashboardData;
  walletKind: WalletKind;
  account: Address;
}) {
  const { network } = useNetwork();
  const { connector, chainId } = useAccount();
  const { btcAddress } = useBitcoinAccount();
  const bitcoinWallet = connector ? isOrangeKitConnector(connector) : false;
  const copy = readinessCopy(readiness, { musd: data.snapshot.musd, walletKind, network });
  // The wrong-chain case has its own alert above the dashboard.
  const notes = [
    walletKindNote(walletKind, bitcoinWallet),
    writeBlocker(network, chainId) === "no-executor" ? writeBlockerMessage("no-executor", network) : null,
  ].filter((note): note is string => note !== null);

  return (
    <Card title="Next step" aside={<Badge tone={BADGE_TONE[copy.tone]}>{copy.tag}</Badge>}>
      <p className="mt-3 text-xl font-semibold">{copy.headline}</p>
      {copy.detail && <p className="mt-1 text-sm text-muted">{copy.detail}</p>}
      <div className="mt-4 flex flex-wrap gap-2 empty:hidden">
        {copy.actions?.map((action) => (
          <ButtonLink key={action.href} href={action.href} external variant="secondary">
            {action.label}
          </ButtonLink>
        ))}
        {readiness.state === "ready" && network.executor && (
          <>
            <ButtonLink href="/route/lp/">Deposit to LP</ButtonLink>
            <ButtonLink href="/route/stability-pool/" variant="secondary">
              Deposit to Stability Pool
            </ButtonLink>
          </>
        )}
        {readiness.state === "can-borrow" && network.executor && <ButtonLink href="/route/lp/?mode=borrow">Borrow & Deploy</ButtonLink>}
      </div>
      <p className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
        <span title={btcAddress ?? account}>
          {connector?.name ?? "Wallet"} · {walletKindLabel(walletKind, bitcoinWallet)} · {shortAddress(account)}
        </span>
        <span className="flex flex-wrap gap-x-4">
          <span>MUSD in wallet {formatToken(data.snapshot.musd, 18, 2)}</span>
          <span>BTC for gas {formatToken(data.gasBalance)}</span>
        </span>
      </p>
      {notes.map((note) => (
        <Notice key={note} className="mt-3">
          {note}
        </Notice>
      ))}
    </Card>
  );
}
