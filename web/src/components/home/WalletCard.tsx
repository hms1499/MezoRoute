"use client";

import { useBitcoinAccount } from "@mezo-org/passport";
import type { ReactNode } from "react";
import { erc20Abi } from "viem";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { writeBlocker, writeBlockerMessage } from "@/lib/config/write-gate";
import { formatToken, shortAddress } from "@/lib/format";
import { isOrangeKitConnector } from "@/lib/wallet/capabilities";
import { walletKindLabel, walletKindNote } from "@/lib/wallet/labels";
import { useWalletKind } from "@/lib/wallet/useWalletKind";

/** F1's connected state; F2 replaces it with readiness, the Trove card, and the exposure panel. */
export function WalletCard() {
  const { network } = useNetwork();
  const { address, connector, chainId } = useAccount();
  const kind = useWalletKind();
  const { btcAddress } = useBitcoinAccount();
  const enabled = Boolean(address);
  // Reads always go to the selected network's RPC, whatever chain the wallet is on.
  const gas = useBalance({ address, chainId: network.chainId, query: { enabled } });
  const musd = useReadContract({
    address: network.addresses.musd,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: network.chainId,
    query: { enabled },
  });

  if (!address || !connector) return null;
  const bitcoinWallet = isOrangeKitConnector(connector);
  const blocker = writeBlocker(network, chainId);
  // The wrong-chain case has its own alert above the card.
  const notes = [
    walletKindNote(kind, bitcoinWallet),
    blocker === "no-executor" ? writeBlockerMessage(blocker, network) : null,
  ].filter((note): note is string => note !== null);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Your wallet</h2>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <Row label="Wallet">
          {connector.name} · {walletKindLabel(kind, bitcoinWallet)}
        </Row>
        {btcAddress && (
          <Row label="Bitcoin address" mono title={btcAddress}>
            {shortAddress(btcAddress)}
          </Row>
        )}
        <Row label="Mezo account" mono title={address}>
          {shortAddress(address)}
        </Row>
        <Row label="BTC for gas">{gas.data ? formatToken(gas.data.value, gas.data.decimals) : "—"}</Row>
        <Row label="MUSD">{musd.data !== undefined ? formatToken(musd.data) : "—"}</Row>
      </dl>
      {notes.map((note) => (
        <p key={note} className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          {note}
        </p>
      ))}
      <div className="mt-4 flex flex-wrap gap-2">
        {network.faucetUrl && <ExternalButton href={network.faucetUrl}>Get test BTC</ExternalButton>}
        <ExternalButton href={network.mezoAppUrl}>Open Mezo app</ExternalButton>
      </div>
    </section>
  );
}

function Row({ label, mono, title, children }: { label: string; mono?: boolean; title?: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? "text-right font-mono" : "text-right"} title={title}>
        {children}
      </dd>
    </>
  );
}

function ExternalButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-accent hover:bg-accent-soft"
    >
      {children}
    </a>
  );
}
