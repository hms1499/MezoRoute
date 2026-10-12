"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { NoExecutorCard } from "@/components/lp/NoExecutorCard";
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
      <div aria-busy="true" aria-label="Loading the quote" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
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
  const preview = exitPreview({
    network,
    data: props.data,
    intent: props.intent,
    walletKind: props.walletKind,
    walletChainId: chainId,
    now,
  });
  const { stepper, run } = useExitFlow({
    account: props.account,
    executor: props.executor,
    intent: props.intent,
    liquidityIn: preview.liquidityIn,
    walletKind: props.walletKind,
    plan: preview.steps,
    refresh: props.refresh,
  });
  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h1 className="text-lg font-semibold">Exit the MUSD/BTC pool to MUSD</h1>
        <ExitForm intent={props.intent} lpBalance={props.data.snapshot.lpBalance} locked={hasStarted(stepper)} onChange={props.onIntent} />
      </section>
      {preview.quote && preview.minimums && (
        <ExitPreviewCard
          quote={preview.quote}
          minimums={preview.minimums}
          gasCost={preview.gasCost}
          blockNumber={props.data.snapshot.blockNumber}
        />
      )}
      <ExitStepper stepper={stepper} run={run} block={preview.block} />
      <Link href="/positions/" className="inline-block text-xs font-semibold text-accent hover:underline">
        Back to positions
      </Link>
    </>
  );
}
