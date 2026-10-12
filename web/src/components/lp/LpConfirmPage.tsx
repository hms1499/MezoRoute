"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { useNetwork } from "@/lib/config/network-context";
import { entryQuery, parseEntryIntent } from "@/lib/routes/musd-btc-lp/intent";
import { entryPreview } from "@/lib/routes/musd-btc-lp/preview";
import { useLpRouteSnapshot } from "@/lib/routes/musd-btc-lp/useLpRouteSnapshot";
import { useNow } from "@/lib/useNow";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { ConfirmSummary } from "./ConfirmSummary";
import { EntryStepper } from "./EntryStepper";
import { NoExecutorCard } from "./NoExecutorCard";

/** Spec §9 screen 3a: a fresh quote with a 60 s expiry, then the permit/approve → send stepper. */
export default function LpConfirmPage() {
  return <RequireWallet>{(account) => <LpConfirm account={account} />}</RequireWallet>;
}

function LpConfirm({ account }: { account: Address }) {
  const { network } = useNetwork();
  if (!network.executor) return <NoExecutorCard />;
  return <ConfirmFlow account={account} executor={network.executor.address} />;
}

function ConfirmFlow({ account, executor }: { account: Address; executor: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = useMemo(() => parseEntryIntent(searchParams), [searchParams]);
  const { data, error, refresh } = useLpRouteSnapshot(account, executor);
  const now = useNow(1_000);

  useEffect(() => {
    if (intent.musdIn === null) router.replace(`/route/lp/${entryQuery(intent)}`);
  }, [intent, router]);

  if (intent.musdIn === null) return null;
  if (!data || !walletKind) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <div aria-busy="true" aria-label="Loading the quote" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
    );
  }

  const preview = entryPreview({ network, data, intent, walletKind, walletChainId: chainId, now });
  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <ConfirmSummary
        preview={preview}
        data={data}
        slippageBps={intent.slippageBps}
        now={now}
        onRefresh={() => void refresh().catch(() => undefined)}
      />
      <EntryStepper
        account={account}
        executor={executor}
        intent={intent}
        walletKind={walletKind}
        plan={preview.steps}
        refresh={refresh}
        block={preview.block}
      />
      <Link href={`/route/lp/${entryQuery(intent)}`} className="inline-block text-xs font-semibold text-accent hover:underline">
        Change amount
      </Link>
    </>
  );
}
