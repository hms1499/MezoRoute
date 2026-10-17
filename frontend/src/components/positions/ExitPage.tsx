"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { NoExecutorCard } from "@/components/lp/NoExecutorCard";
import { RouteLayout } from "@/components/route/RouteLayout";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingCard } from "@/components/ui/Skeleton";
import { useNetwork } from "@/lib/config/network-context";
import { exitQuery, parseExitIntent, type ExitIntent } from "@/lib/positions/exit-intent";
import { exitPreview } from "@/lib/positions/exit-preview";
import type { PositionsData } from "@/lib/positions/snapshot";
import { useExitFlow } from "@/lib/positions/useExitFlow";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { hasStarted } from "@/lib/tx/stepper";
import { useNow } from "@/lib/useNow";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { ExitForm } from "./ExitForm";
import { ExitPreviewCard } from "./ExitPreviewCard";
import { ExitStepper } from "./ExitStepper";

/** Spec §9 screen 6a: share or Max, quote, minimum MUSD, permit (smart account: approve) → send. */
export default function ExitPage() {
  return <RequireWallet>{(account) => <ExitRoute account={account} />}</RequireWallet>;
}

function ExitRoute({ account }: { account: Address }) {
  const { network } = useNetwork();
  if (!network.executor) return <NoExecutorCard />;
  return <ExitLoader account={account} executor={network.executor.address} />;
}

function ExitLoader({ account, executor }: { account: Address; executor: Address }) {
  const walletKind = useWalletKind();
  const searchParams = useSearchParams();
  const [intent, setIntent] = useState<ExitIntent>(() => parseExitIntent(searchParams));
  const { data, error, refresh } = usePositionsSnapshot(account);

  if (!data || !walletKind) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <LoadingCard label="Loading the quote" />
    );
  }
  return (
    <ExitFlowView
      account={account}
      executor={executor}
      walletKind={walletKind}
      data={data}
      refresh={refresh}
      intent={intent}
      onIntent={(next) => {
        setIntent(next);
        window.history.replaceState(null, "", exitQuery(next));
      }}
    />
  );
}

function ExitFlowView(props: {
  account: Address;
  executor: Address;
  walletKind: WalletKind;
  data: PositionsData;
  refresh: () => Promise<PositionsData>;
  intent: ExitIntent;
  onIntent: (next: ExitIntent) => void;
}) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const now = useNow(1_000);
  const previewInput = { network, data: props.data, intent: props.intent, walletKind: props.walletKind, walletChainId: chainId, now };
  // Before the first step the amount follows the percent; the flow then pins it.
  const unpinned = exitPreview(previewInput);
  const { stepper, run, restart, pinnedLiquidity } = useExitFlow({
    account: props.account,
    executor: props.executor,
    intent: props.intent,
    liquidityIn: unpinned.liquidityIn,
    walletKind: props.walletKind,
    plan: unpinned.steps,
    refresh: props.refresh,
  });
  // What the page shows and gates on is what the flow will send.
  const preview = pinnedLiquidity === null ? unpinned : exitPreview({ ...previewInput, liquidityIn: pinnedLiquidity });
  return (
    <RouteLayout
      header={
        <PageHeader
          back={{ href: "/positions/", label: "Positions" }}
          step={hasStarted(stepper) ? 2 : 1}
          title="Exit the MUSD/BTC pool to MUSD"
        />
      }
      summary={<ExitStepper stepper={stepper} run={run} restart={restart} block={preview.block} />}
    >
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <Card>
        <ExitForm intent={props.intent} lpBalance={props.data.snapshot.lpBalance} amountLocked={hasStarted(stepper)} onChange={props.onIntent} />
      </Card>
      {preview.quote && preview.minimums && (
        <ExitPreviewCard quote={preview.quote} minimums={preview.minimums} gasCost={preview.gasCost} blockNumber={props.data.snapshot.blockNumber} />
      )}
    </RouteLayout>
  );
}
