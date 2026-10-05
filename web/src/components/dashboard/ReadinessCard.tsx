"use client";

import { useBitcoinAccount } from "@mezo-org/passport";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { ExternalButton } from "@/components/ExternalButton";
import { useNetwork } from "@/lib/config/network-context";
import { writeBlocker, writeBlockerMessage } from "@/lib/config/write-gate";
import { readinessCopy, type Readiness, type ReadinessCopy } from "@/lib/dashboard/readiness";
import type { DashboardData } from "@/lib/dashboard/useDashboardSnapshot";
import { formatToken, shortAddress } from "@/lib/format";
import { isOrangeKitConnector, type WalletKind } from "@/lib/wallet/capabilities";
import { walletKindLabel, walletKindNote } from "@/lib/wallet/labels";

const TAG_TONE: Record<ReadinessCopy["tone"], string> = {
  positive: "bg-accent-soft text-accent",
  attention: "bg-warning-bg text-warning-ink",
  neutral: "bg-line text-muted",
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
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_TONE[copy.tone]}`}>{copy.tag}</span>
      <p className="mt-3 text-lg font-semibold leading-snug">{copy.headline}</p>
      {copy.detail && <p className="mt-1 text-sm text-muted">{copy.detail}</p>}
      {copy.action && (
        <div className="mt-4">
          <ExternalButton href={copy.action.href}>{copy.action.label}</ExternalButton>
        </div>
      )}
      <p className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
        <span title={btcAddress ?? account}>
          {connector?.name ?? "Wallet"} · {walletKindLabel(walletKind, bitcoinWallet)} · {shortAddress(account)}
        </span>
        <span>BTC for gas {formatToken(data.gasBalance)}</span>
      </p>
      {notes.map((note) => (
        <p key={note} className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          {note}
        </p>
      ))}
    </section>
  );
}
