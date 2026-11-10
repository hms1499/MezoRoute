"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { BeforeYouSign } from "@/components/flow/BeforeYouSign";
import { ConfirmAside, ConfirmCard } from "@/components/flow/ConfirmCard";
import { spSignFacts } from "@/lib/flow/sign-facts";
import { FlowColumn, FlowState } from "@/components/flow/FlowColumn";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingCard } from "@/components/ui/Skeleton";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { useNetwork } from "@/lib/config/network-context";
import { SP_RISKS } from "@/lib/routes/copy";
import { parseMusdAmount } from "@/lib/quote/amount";
import { spDepositQuery } from "@/lib/stability-pool/intent";
import { spDepositPreview } from "@/lib/stability-pool/preview";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { spConfirmRows } from "./SpDepositCard";
import { SpDepositStepper } from "./SpDepositStepper";

/** Spec §9 screen 3b: exact approval (skipped if the allowance suffices) → provideToSP. */
export default function SpConfirmPage() {
  return <RequireWallet flow>{(account) => <SpConfirm account={account} />}</RequireWallet>;
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
      <FlowState><LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} /></FlowState>
    ) : (
      <FlowState><LoadingCard label="Loading the Stability Pool" /></FlowState>
    );
  }

  const preview = spDepositPreview({ network, data, musdIn, walletKind, walletChainId: chainId });
  return (
    // U11 §6.2, U14 §A: the amount page's grid; the full risk list is always visible before signing (beside the card
    // from lg, in it above the steps below).
    <FlowColumn
      aside={
        <ConfirmAside risks={SP_RISKS}>
          <BeforeYouSign facts={spSignFacts(network, data.snapshot.blockNumber)} />
        </ConfirmAside>
      }
      header={
        <>
          <PageHeader back={{ href: `/route/stability-pool/${spDepositQuery(amount)}`, label: "Change amount" }} step={2} title="Review your deposit" />
          {chainId !== network.chainId && <WrongNetworkAlert />}
        </>
      }
    >
      <ConfirmCard
        icon={<TokenIcon token="musd" size={24} />}
        title="Stability Pool"
        overview={spConfirmRows(preview, musdIn)}
        risks={SP_RISKS}
        risksPlacement="aside-from-lg"
        steps={<SpDepositStepper account={account} musdIn={musdIn} walletKind={walletKind} plan={preview.steps} refresh={refresh} block={preview.block} />}
      />
    </FlowColumn>
  );
}
