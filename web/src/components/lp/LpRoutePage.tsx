"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { ExposurePanel } from "@/components/dashboard/ExposurePanel";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { useNetwork } from "@/lib/config/network-context";
import { entryQuery, parseEntryIntent, type EntryIntent } from "@/lib/routes/musd-btc-lp/intent";
import { entryPreview } from "@/lib/routes/musd-btc-lp/preview";
import { useLpRouteSnapshot } from "@/lib/routes/musd-btc-lp/useLpRouteSnapshot";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { AmountForm } from "./AmountForm";
import { BlockNotice } from "./BlockNotice";
import { EntryPreviewCard } from "./EntryPreviewCard";
import { ExposureChange } from "./ExposureChange";
import { ModeToggle } from "./ModeToggle";
import { NoExecutorCard } from "./NoExecutorCard";
import { RisksCard } from "./RisksCard";
import { TroveChangeCard } from "./TroveChangeCard";

/** Spec §9 screen 2a: amount, preview, exposure before/after, risks, Review. */
export default function LpRoutePage() {
  return <RequireWallet>{(account) => <LpRoute account={account} />}</RequireWallet>;
}

function LpRoute({ account }: { account: Address }) {
  const { network } = useNetwork();
  if (!network.executor) return <NoExecutorCard />;
  return <LpRouteForm account={account} executor={network.executor.address} />;
}

function LpRouteForm({ account, executor }: { account: Address; executor: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const searchParams = useSearchParams();
  const [intent, setIntent] = useState<EntryIntent>(() => parseEntryIntent(searchParams));
  const { data, error, refresh } = useLpRouteSnapshot(account, executor);

  function update(next: Pick<EntryIntent, "amount" | "slippageBps" | "mode">) {
    const query = entryQuery(next);
    setIntent(parseEntryIntent(new URLSearchParams(query)));
    window.history.replaceState(null, "", query);
  }

  if (!data) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <div aria-busy="true" aria-label="Loading the pool" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
    );
  }

  // The route page refetches every 15 s, so its quote never expires here; the confirm page checks age.
  const preview = entryPreview({
    network,
    data,
    intent,
    walletKind: walletKind ?? "unknown",
    walletChainId: chainId,
    now: data.fetchedAt,
  });

  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <section className="card">
        <h1 className="text-lg font-semibold">Earn swap fees in the MUSD/BTC pool</h1>
        <ModeToggle walletKind={walletKind} mode={intent.mode} onChange={(mode) => update({ ...intent, mode })} />
        <AmountForm
          amount={intent.amount}
          slippageBps={intent.slippageBps}
          max={preview.borrow ? preview.borrow.limit : data.snapshot.dashboard.musd}
          maxLabel={preview.borrow ? "You can borrow" : "In your wallet"}
          onChange={(next) => update({ ...next, mode: intent.mode })}
        />
      </section>
      {preview.quote && preview.minimums && (
        <EntryPreviewCard
          quote={preview.quote}
          minimums={preview.minimums}
          feeBps={data.snapshot.executorFeeBps}
          gasCost={preview.gasCost}
          borrowFee={preview.borrow?.effect?.fee}
        />
      )}
      {preview.borrow?.trove && preview.borrow.effect && (
        <TroveChangeCard
          trove={preview.borrow.trove}
          effect={preview.borrow.effect}
          price={data.snapshot.dashboard.price}
          mcr={data.snapshot.dashboard.protocol.mcr}
        />
      )}
      {preview.after && <ExposureChange before={data.snapshot.dashboard} after={preview.after} />}
      {preview.after && <ExposurePanel snapshot={preview.after} title="BTC exposure after this deposit" />}
      <RisksCard borrow={intent.mode === "borrow"} />
      <div className="flex items-center justify-between gap-3">
        <BlockNotice block={preview.block} />
        {preview.block ? (
          <span aria-disabled="true" className="ml-auto rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white opacity-50">
            Review
          </span>
        ) : (
          <Link
            href={`/route/lp/confirm/${entryQuery(intent)}`}
            className="ml-auto rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Review
          </Link>
        )}
      </div>
    </>
  );
}
