"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import { useAccount } from "wagmi";
import { ExposurePanel } from "@/components/dashboard/ExposurePanel";
import { ActionCard } from "@/components/flow/ActionCard";
import { ConfirmCard } from "@/components/flow/ConfirmCard";
import { Details } from "@/components/flow/Details";
import { FlowColumn } from "@/components/flow/FlowColumn";
import { Overview } from "@/components/flow/Overview";
import { SlippagePopover } from "@/components/flow/SlippagePopover";
import { TokenAmountInput } from "@/components/flow/TokenAmountInput";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingCard } from "@/components/ui/Skeleton";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { useNetwork } from "@/lib/config/network-context";
import { formatPercent } from "@/lib/format";
import { troveActionBlock, type GateQuote } from "@/lib/leverage/gate";
import { intentQuery, parseIntent, type TroveAction, type TroveIntent } from "@/lib/leverage/intent";
import { redemptionQueue, type QueueEntry } from "@/lib/leverage/queue";
import { troveRisks } from "@/lib/leverage/risks";
import type { TroveSnapshot } from "@/lib/leverage/snapshot";
import { quoteFor, troveSteps } from "@/lib/leverage/steps";
import { cr, nominalCr, type TroveState } from "@/lib/leverage/trove-math";
import { useDirectTroveCall } from "@/lib/leverage/useDirectTroveCall";
import { useTroveSnapshot, type TroveData } from "@/lib/leverage/useTroveSnapshot";
import { crPresets, leverageMaxNote, pageNotice, refinanceNote, troveOverviewRows } from "@/lib/leverage/view";
import { leverageMax, leverageQuoteAt } from "@/lib/leverage/quote-leverage";
import { Notice } from "@/components/ui/Notice";
import { queueLine } from "@/lib/leverage/copy";
import { LEVERAGE_CR_FLOOR, ORACLE_BOUND_DEFAULT_BPS } from "@/lib/trove/constants";
import { useNow } from "@/lib/useNow";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import type { SlippageBps } from "@/lib/quote/entry";
import { TroveStepper } from "./TroveStepper";
import { CrField, QueueLine, TroveNotice } from "./TroveViews";

const TITLES: Record<TroveAction, { amount: string; confirm: string; card: string }> = {
  unwind: { amount: "Unwind your Trove", confirm: "Review your unwind", card: "Unwind" },
  close: { amount: "Close your Trove", confirm: "Review closing your Trove", card: "Close" },
  leverage: { amount: "Leverage your Trove", confirm: "Review your leverage", card: "Leverage" },
  open: { amount: "Open a Trove with leverage", confirm: "Review your new Trove", card: "Open with leverage" },
};

function afterTrove(quote: GateQuote | null): TroveState | null {
  if (!quote) return null;
  if (quote.action === "close") return null;
  if (quote.action === "open") return quote.quote?.after ?? null;
  return quote.quote.after;
}

/** Everything both Trove pages derive from one snapshot and the intent. */
function useTroveView(action: TroveAction, account: Address, data: TroveData, queue: QueueEntry[] | null, intent: TroveIntent) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind() ?? "unknown";
  const now = useNow(1_000);
  const quote = quoteFor(action, data.snapshot, intent, network);
  const block = troveActionBlock({
    action,
    network,
    walletChainId: chainId,
    walletKind,
    snapshot: data.snapshot,
    fetchedAt: data.fetchedAt,
    now,
    quote,
    boundBps: ORACLE_BOUND_DEFAULT_BPS,
  });
  const after = afterTrove(quote);
  const mcr = data.snapshot.market.mcr;
  const queueBefore = queue && data.snapshot.trove ? redemptionQueue(queue, account, null, mcr) : null;
  const queueAfter = queue && after ? redemptionQueue(queue, account, nominalCr(after), mcr) : null;
  return {
    quote,
    block,
    walletKind,
    rows: quote ? troveOverviewRows(quote, data.snapshot) : [],
    queueBefore,
    queueAfter,
    notice: pageNotice({ action, snapshot: data.snapshot, network, block: block?.reason ?? null }),
    after,
  };
}

function Loading({ error, retry, label }: { error: Error | null; retry: () => void; label: string }) {
  return error ? <LoadError error={error} onRetry={retry} /> : <LoadingCard label={label} />;
}

// ---------------------------------------------------------------------------------- amount page

export function TroveAmountPage({ action }: { action: TroveAction }) {
  return <RequireWallet>{(account) => <AmountFlow action={action} account={account} />}</RequireWallet>;
}

function AmountFlow({ action, account }: { action: TroveAction; account: Address }) {
  const { data, error, queue, refresh } = useTroveSnapshot(account);
  const search = useSearchParams();
  const initial = useMemo(() => parseIntent(action, search), [action, search]);
  const [crText, setCrText] = useState(initial.cr === null ? "" : formatUnits(initial.cr, 16));
  const [btcText, setBtcText] = useState(initial.btc === null ? "" : formatUnits(initial.btc, 18));
  const [slippageBps, setSlippageBps] = useState<SlippageBps>(initial.slippageBps as SlippageBps);
  if (!data) return <Loading error={error} retry={() => void refresh().catch(() => undefined)} label="Loading your Trove" />;
  const intent: TroveIntent = { cr: parsePercent(crText), btc: parseBtc(btcText), slippageBps };
  return (
    <AmountCard
      action={action}
      account={account}
      data={data}
      queue={queue}
      intent={intent}
      crText={crText}
      onCr={setCrText}
      btcText={btcText}
      onBtc={setBtcText}
      onSlippage={setSlippageBps}
    />
  );
}

function parsePercent(text: string): bigint | null {
  try {
    const v = parseUnits(text.trim(), 16);
    return v > 0n ? v : null;
  } catch {
    return null;
  }
}

function parseBtc(text: string): bigint | null {
  try {
    const v = parseUnits(text.trim(), 18);
    return v > 0n ? v : null;
  } catch {
    return null;
  }
}

function AmountCard(props: {
  action: TroveAction;
  account: Address;
  data: TroveData;
  queue: QueueEntry[] | null;
  intent: TroveIntent;
  crText: string;
  onCr: (v: string) => void;
  btcText: string;
  onBtc: (v: string) => void;
  onSlippage: (bps: SlippageBps) => void;
}) {
  const { action, account, data, intent } = props;
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const view = useTroveView(action, account, data, props.queue, intent);
  const direct = useDirectTroveCall(account);
  const snapshot: TroveSnapshot = data.snapshot;
  const current = snapshot.trove ? cr(snapshot.trove, snapshot.market.price) : null;
  const presets = action === "unwind" || action === "leverage" ? (current ? crPresets(action, current) : []) : [2_000_000_000_000_000_000n, 2_500_000_000_000_000_000n, 3_000_000_000_000_000_000n];
  const canReview = view.block === null && view.quote !== null;
  // Leverage: the largest size the page offers and what stops it (spec L1, Inputs).
  const max =
    action === "leverage" && snapshot.trove && network.leverage
      ? leverageMax(snapshot.trove, snapshot.pool, snapshot.market, network.leverage.feeBps, { maxBtcFlash: network.leverage.maxBtcFlash }, ORACLE_BOUND_DEFAULT_BPS, intent.slippageBps)
      : null;
  const maxCr =
    max && max.btc > 0n && snapshot.trove && network.leverage
      ? leverageQuoteAt(snapshot.trove, snapshot.pool, snapshot.market, max.btc, intent.slippageBps, network.leverage.feeBps).crAfter
      : null;
  const confirmHref = `/trove/${action}/confirm/?${intentQuery(action, intent)}`;
  const repay = () =>
    snapshot.trove &&
    direct.run({ kind: "repay", amount: snapshot.walletMusd < snapshot.trove.debt - 2_000n * 10n ** 18n ? snapshot.walletMusd : snapshot.trove.debt - 2_000n * 10n ** 18n, trove: snapshot.trove, troveCount: snapshot.system.troveCount });

  return (
    <FlowColumn
      header={
        <>
          <PageHeader back={{ href: "/", label: "Dashboard" }} step={1} title={TITLES[action].amount} />
          {chainId !== network.chainId && <WrongNetworkAlert />}
          <TroveNotice notice={view.notice} onRepay={repay} />
        </>
      }
    >
      <ActionCard
        icon={<TokenIcon token="btc" size={24} />}
        title={TITLES[action].card}
        subtitle="Your Trove · MUSD/BTC pool · one transaction"
        figure={current === null ? "—" : formatPercent(current)}
        figureLabel="Collateral ratio now"
        settings={<SlippagePopover slippageBps={intent.slippageBps as SlippageBps} onChange={props.onSlippage} action={action === "unwind" || action === "close" ? "sale" : "purchase"} />}
        risk={troveRisks(action)[0]}
        action={
          canReview ? (
            <ButtonLink href={confirmHref} size="lg" arrow className="w-full">
              Review
            </ButtonLink>
          ) : (
            <Button size="lg" disabled className="w-full">
              Review
            </Button>
          )
        }
      >
        {action === "open" && (
          <TokenAmountInput
            id="btc-in"
            label="Your BTC"
            amount={props.btcText}
            onAmount={props.onBtc}
            token="btc"
            balance={snapshot.walletBtc}
            max={snapshot.walletBtc}
          />
        )}
        {action !== "close" && (
          <CrField
            value={props.crText}
            onChange={props.onCr}
            presets={presets}
            label={action === "unwind" ? "Target collateral ratio (higher)" : "Target collateral ratio (200% or more)"}
          />
        )}
        {max && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span>{leverageMaxNote(max, LEVERAGE_CR_FLOOR)}</span>
            {maxCr !== null && (
              <Button size="sm" variant="quiet" onClick={() => props.onCr(roundUpPercent(maxCr))}>
                Use the most
              </Button>
            )}
          </div>
        )}
        {view.rows.length > 0 && <Overview rows={view.rows} />}
        {view.block?.outcome && view.block.reason !== "recovery-mode" && view.block.reason !== "smart-account" && (
          <p role="status" className="text-sm text-danger">
            {view.block.outcome.message}
          </p>
        )}
        <QueueLine before={view.queueBefore} after={view.queueAfter} />
      </ActionCard>
      {view.after && (
        <Details summary="If BTC moves">
          <ExposurePanel
            title="Trove BTC exposure"
            snapshot={troveOnlySnapshot(snapshot, view.after)}
            before={snapshot.trove ? troveOnlySnapshot(snapshot, snapshot.trove) : undefined}
          />
        </Details>
      )}
    </FlowColumn>
  );
}

/** A CR as a percent string rounded up to 0.1% (so the quote lands at or above it, never below). */
function roundUpPercent(ratio: bigint): string {
  const tenths = (ratio * 1000n + 10n ** 18n - 1n) / 10n ** 18n;
  return `${tenths / 10n}.${tenths % 10n}`;
}

/** The exposure panel's input for the Trove alone (LP and Stability Pool left out): before and after the action. */
function troveOnlySnapshot(s: TroveSnapshot, t: TroveState): DashboardSnapshot {
  return {
    price: s.market.price,
    protocol: { mcr: s.market.mcr, borrowingRate: s.market.borrowingRate },
    trove: { collateral: t.coll, principal: t.principal, interest: t.interest, debt: t.debt, maxBorrowingCapacity: t.maxBorrowingCapacity },
    musd: s.walletMusd,
    lp: { balance: 0n, totalSupply: 0n, reserveMusd: s.pool.reserveMusd, reserveBtc: s.pool.reserveBtc },
    sp: { deposit: 0n, btcGain: 0n },
    poolFeeBps: s.pool.feeBps,
    gauge: null,
    gaugeReadFailed: false,
    block: null,
    troveDebt: null,
    protocolOwnedSp: null,
  } as DashboardSnapshot;
}

// ---------------------------------------------------------------------------------- confirm page

export function TroveConfirmPage({ action }: { action: TroveAction }) {
  return <RequireWallet>{(account) => <ConfirmFlow action={action} account={account} />}</RequireWallet>;
}

function ConfirmFlow({ action, account }: { action: TroveAction; account: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const search = useSearchParams();
  const intent = useMemo(() => parseIntent(action, search), [action, search]);
  const { data, error, queue, refresh } = useTroveSnapshot(account);
  if (!data) return <Loading error={error} retry={() => void refresh().catch(() => undefined)} label="Loading the quote" />;
  return <ConfirmBody action={action} account={account} data={data} queue={queue} intent={intent} refresh={refresh} wrongNetwork={chainId !== network.chainId} />;
}

function ConfirmBody(props: {
  action: TroveAction;
  account: Address;
  data: TroveData;
  queue: QueueEntry[] | null;
  intent: TroveIntent;
  refresh: () => Promise<TroveData>;
  wrongNetwork: boolean;
}) {
  const { action, account, data, intent } = props;
  const view = useTroveView(action, account, data, props.queue, intent);
  const capacity = view.quote?.action === "leverage" ? view.quote.quote.capacity : "ok";
  const risks = troveRisks(action);
  const queueFirst = (action === "leverage" || action === "open") && view.queueAfter ? [`After this: ${queueLine(view.queueAfter)}`, ...risks] : risks;
  return (
    <FlowColumn
      header={
        <>
          <PageHeader back={{ href: `/trove/${action}/?${intentQuery(action, intent)}`, label: "Change" }} step={2} title={TITLES[action].confirm} />
          {props.wrongNetwork && <WrongNetworkAlert />}
          <TroveNotice notice={view.notice} />
        </>
      }
    >
      <ConfirmCard
        icon={<TokenIcon token="btc" size={24} />}
        title={TITLES[action].card}
        subtitle="Your Trove · MUSD/BTC pool · one transaction"
        overview={view.rows}
        quote={<QueueLine before={view.queueBefore} after={view.queueAfter} />}
        risks={queueFirst}
        footnote={
          refinanceNote(capacity) && (
            <Notice tone="neutral" role="note">
              {refinanceNote(capacity)}
            </Notice>
          )
        }
        steps={
          <TroveStepper
            action={action}
            account={account}
            intent={intent}
            walletKind={view.walletKind}
            plan={troveSteps(action, capacity)}
            refresh={props.refresh}
            block={view.block}
          />
        }
      />
    </FlowColumn>
  );
}
