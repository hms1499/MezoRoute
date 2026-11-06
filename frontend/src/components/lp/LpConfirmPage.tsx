"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { ConfirmCard } from "@/components/flow/ConfirmCard";
import { FlowColumn } from "@/components/flow/FlowColumn";
import { Notice } from "@/components/ui/Notice";
import { PairIcon } from "@/components/ui/TokenIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingCard } from "@/components/ui/Skeleton";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { useNetwork } from "@/lib/config/network-context";
import { entryRisks } from "@/lib/flow/risks";
import { entryQuery, intentAmount, parseEntryIntent } from "@/lib/routes/musd-btc-lp/intent";
import { entryPreview } from "@/lib/routes/musd-btc-lp/preview";
import { useLpRouteSnapshot } from "@/lib/routes/musd-btc-lp/useLpRouteSnapshot";
import { useNow } from "@/lib/useNow";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { confirmOverview, QuoteBlock } from "./ConfirmSummary";
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
    if (intentAmount(intent) === null) router.replace(`/route/lp/${entryQuery(intent)}`);
  }, [intent, router]);

  if (intentAmount(intent) === null) return null;
  if (!data || !walletKind) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <LoadingCard label="Loading the quote" />
    );
  }

  const preview = entryPreview({ network, data, intent, walletKind, walletChainId: chainId, now });
  return (
    // U11 §6.2: the same column as the amount page; the full risk list is always visible before signing.
    <FlowColumn
      header={
        <>
          <PageHeader
            back={{ href: `/route/lp/${entryQuery(intent)}`, label: "Change amount" }}
            step={2}
            title={preview.borrow ? "Review your borrow and deposit" : "Review your deposit"}
          />
          {chainId !== network.chainId && <WrongNetworkAlert />}
        </>
      }
    >
      <ConfirmCard
        icon={<PairIcon tokens={["musd", "btc"]} size={24} />}
        title="MUSD / BTC"
        subtitle="Volatile pool · Tigris"
        overview={confirmOverview({ preview, data, slippageBps: intent.slippageBps })}
        quote={<QuoteBlock data={data} now={now} onRefresh={() => void refresh().catch(() => undefined)} />}
        risks={entryRisks({ borrow: intent.mode === "borrow", fromBtc: intent.asset === "btc" })}
        steps={
          <EntryStepper
            account={account}
            executor={executor}
            intent={intent}
            walletKind={walletKind}
            plan={preview.steps}
            refresh={refresh}
            block={preview.block}
            stake={preview.stake.on}
          />
        }
        footnote={<Notice>MezoRoute never holds your funds between transactions.</Notice>}
      />
    </FlowColumn>
  );
}
