"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { NoExecutorCard } from "@/components/lp/NoExecutorCard";
import { ActionCard } from "@/components/flow/ActionCard";
import { BeforeYouSign } from "@/components/flow/BeforeYouSign";
import { Details } from "@/components/flow/Details";
import { FlowColumn, FlowState } from "@/components/flow/FlowColumn";
import { Overview } from "@/components/flow/Overview";
import { ReceiveRow } from "@/components/flow/ReceiveRow";
import { SlippagePopover } from "@/components/flow/SlippagePopover";
import { TokenAmountInput } from "@/components/flow/TokenAmountInput";
import { lp, musd } from "@/components/lp/units";
import { PairIcon, TokenIcon } from "@/components/ui/TokenIcon";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LoadingCard } from "@/components/ui/Skeleton";
import { lpSignFacts } from "@/lib/flow/sign-facts";
import { exitPositionRows } from "@/lib/positions/view";
import { useNetwork } from "@/lib/config/network-context";
import { GAUGE_READ_FAILED_EXIT } from "@/lib/gauge/copy";
import { formatToken } from "@/lib/format";
import { exitCopy } from "@/lib/positions/exit-copy";
import { EXIT_PERCENTS, exitQuery, parseExitIntent, type ExitIntent, type ExitPercent } from "@/lib/positions/exit-intent";
import { exitPreview } from "@/lib/positions/exit-preview";
import type { PositionsData } from "@/lib/positions/snapshot";
import { useExitFlow } from "@/lib/positions/useExitFlow";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { hasStarted } from "@/lib/tx/stepper";
import { useNow } from "@/lib/useNow";
import type { WalletKind } from "@/lib/wallet/capabilities";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { ExitNotes, exitDetailRows, exitOverview } from "./ExitPreviewCard";
import { ExitStepper } from "./ExitStepper";

/** Spec §9 screen 6a; U11 §6.2: one action card (share, overview, steps), the notes behind Details. */
export default function ExitPage() {
  return <RequireWallet flow>{(account) => <ExitRoute account={account} />}</RequireWallet>;
}

function ExitRoute({ account }: { account: Address }) {
  const { network } = useNetwork();
  if (!network.executor) return <FlowState><NoExecutorCard /></FlowState>;
  return <ExitLoader account={account} executor={network.executor.address} />;
}

function ExitLoader({ account, executor }: { account: Address; executor: Address }) {
  const walletKind = useWalletKind();
  const searchParams = useSearchParams();
  const [intent, setIntent] = useState<ExitIntent>(() => parseExitIntent(searchParams));
  const { data, error, refresh } = usePositionsSnapshot(account);

  if (!data || !walletKind) {
    return error ? (
      <FlowState><LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} /></FlowState>
    ) : (
      <FlowState><LoadingCard label="Loading the quote" /></FlowState>
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
  const walletLp = props.data.snapshot.lpBalance;
  const stakedLp = props.data.snapshot.gauge?.staked ?? 0n;
  const locked = hasStarted(stepper);
  return (
    <FlowColumn
      header={<PageHeader back={{ href: "/positions/", label: "Positions" }} step={locked ? 2 : 1} title="Exit the MUSD/BTC pool to MUSD" />}
      aside={
        <>
          <Card title="Your position">
            <Overview rows={exitPositionRows(props.data.snapshot)} className="mt-3" />
          </Card>
          <BeforeYouSign
            facts={lpSignFacts(network, { feeBps: 0n, capMusd: null, blockNumber: props.data.snapshot.blockNumber, exit: { walletKind: props.walletKind } })}
          />
        </>
      }
    >
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <ActionCard
        icon={<PairIcon tokens={["musd", "btc"]} size={24} />}
        title="Exit to MUSD"
        subtitle="MUSD / BTC pool"
        figure="No MezoRoute fee"
        settings={<SlippagePopover slippageBps={props.intent.slippageBps} onChange={(slippageBps) => props.onIntent({ ...props.intent, slippageBps })} action="exit" />}
      >
        {props.data.snapshot.gaugeReadFailed && (
          <Notice tone="warning" role="status">
            {GAUGE_READ_FAILED_EXIT}
          </Notice>
        )}
        <TokenAmountInput
          id="exit-amount"
          label="You exit"
          amount={formatToken(preview.liquidityIn)}
          token="lp"
          balance={walletLp + stakedLp}
          balanceLabel="Your LP"
          max={null}
          note={stakedLp > 0n ? (walletLp === 0n ? "All staked in the gauge" : `${lp(stakedLp)} of it staked in the gauge`) : undefined}
          percent={{
            value: props.intent.percent,
            presets: EXIT_PERCENTS,
            label: "Amount to exit",
            disabled: locked,
            onPreset: (percent) => props.onIntent({ ...props.intent, percent: percent as ExitPercent }),
          }}
        />
        {preview.quote && preview.minimums && (
          <>
            <ReceiveRow value={`≈ ${musd(preview.quote.musdOut)}`} minimum={`At least ${musd(preview.minimums.minMusdOut)}`} icon={<TokenIcon token="musd" size={20} />} />
            <Overview rows={exitOverview({ quote: preview.quote, minimums: preview.minimums, steps: preview.steps, unstake: preview.unstake, gasCost: preview.gasCost })} />
          </>
        )}
        {props.intent.slippageBps === 200n && (
          <Notice tone="warning">2% slippage lets this exit fill up to 2% below the quote. Use it only if lower settings keep failing.</Notice>
        )}
        <ExitStepper stepper={stepper} run={run} restart={restart} block={preview.block} plan={preview.steps} />
      </ActionCard>
      <Details>
        <div className="space-y-4">
          {preview.quote && <Overview rows={exitDetailRows({ quote: preview.quote, gasCost: preview.gasCost })} />}
          <ExitNotes unstakeNote={exitCopy(preview.steps).unstakeNote} blockNumber={props.data.snapshot.blockNumber} />
        </div>
      </Details>
    </FlowColumn>
  );
}
