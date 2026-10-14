"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { useNetwork } from "@/lib/config/network-context";
import { parseMusdAmount } from "@/lib/quote/amount";
import { spDepositQuery } from "@/lib/stability-pool/intent";
import { spDepositPreview } from "@/lib/stability-pool/preview";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { SpDepositCard } from "./SpDepositCard";
import { SpDepositStepper } from "./SpDepositStepper";

/** Spec §9 screen 3b: exact approval (skipped if the allowance suffices) → provideToSP. */
export default function SpConfirmPage() {
  return <RequireWallet>{(account) => <SpConfirm account={account} />}</RequireWallet>;
}

function SpConfirm({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const router = useRouter();
  const amount = useSearchParams().get("amount") ?? "";
  const musdIn = parseMusdAmount(amount);
  const { data, error, refresh } = useSpSnapshot(account);

  useEffect(() => {
    if (musdIn === null) router.replace(`/route/stability-pool/${spDepositQuery(amount)}`);
  }, [musdIn, amount, router]);

  if (musdIn === null) return null;
  if (!data || !walletKind) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <div aria-busy="true" aria-label="Loading the Stability Pool" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
    );
  }

  const preview = spDepositPreview({ network, data, musdIn, walletKind, walletChainId: chainId });
  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <SpDepositCard preview={preview} />
      <SpDepositStepper account={account} musdIn={musdIn} walletKind={walletKind} plan={preview.steps} refresh={refresh} block={preview.block} />
      <Link href={`/route/stability-pool/${spDepositQuery(amount)}`} className="inline-block text-xs font-semibold text-accent hover:underline">
        Change amount
      </Link>
    </>
  );
}
