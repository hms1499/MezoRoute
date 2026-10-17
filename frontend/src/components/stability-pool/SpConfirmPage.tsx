"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { RouteLayout } from "@/components/route/RouteLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingCard } from "@/components/ui/Skeleton";
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
      <LoadingCard label="Loading the Stability Pool" />
    );
  }

  const preview = spDepositPreview({ network, data, musdIn, walletKind, walletChainId: chainId });
  return (
    // The same columns as the amount page (U3 §5.3): the review on the left, the steps where the summary was.
    <RouteLayout
      header={
        <>
          <PageHeader back={{ href: `/route/stability-pool/${spDepositQuery(amount)}`, label: "Change amount" }} step={2} />
          {chainId !== network.chainId && <WrongNetworkAlert />}
        </>
      }
      summary={<SpDepositStepper account={account} musdIn={musdIn} walletKind={walletKind} plan={preview.steps} refresh={refresh} block={preview.block} />}
    >
      <SpDepositCard preview={preview} />
    </RouteLayout>
  );
}
