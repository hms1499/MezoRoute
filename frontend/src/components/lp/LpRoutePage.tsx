"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount } from "wagmi";
import { ExposurePanel } from "@/components/dashboard/ExposurePanel";
import { ConnectCta } from "@/components/home/ConnectCta";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { BeforeYouSign } from "@/components/flow/BeforeYouSign";
import { FlowColumn, FlowState } from "@/components/flow/FlowColumn";
import type { OverviewRow } from "@/components/flow/Overview";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingCard } from "@/components/ui/Skeleton";
import { Term } from "@/components/ui/Term";
import { useNetwork } from "@/lib/config/network-context";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { entryWorth } from "@/lib/flow/entry-worth";
import { WAD } from "@/lib/math";
import { stakeRowCopy } from "@/lib/gauge/copy";
import { emissionsApr, mezoPerWeek } from "@/lib/gauge/maths";
import { useMezoPrice } from "@/lib/gauge/useMezoPrice";
import { exposure } from "@/lib/exposure/exposure";
import { lpAmountField, lpHeaderFigure, lpRiskLine } from "@/lib/flow/lp-entry";
import { splitPrimary } from "@/lib/flow/notice-action";
import { plannerView } from "@/lib/flow/planner";
import { isFieldBlock, lpFieldError } from "@/lib/flow/field-error";
import { lpSignFacts } from "@/lib/flow/sign-facts";
import { BTC_COMPARE_MESSAGE, plannerAmount, plannerComparisonRows } from "@/lib/flow/planner-comparison";
import { btcRecoveries } from "@/lib/routes/musd-btc-lp/asset";
import { entryQuery, parseEntryIntent, type EntryIntent } from "@/lib/routes/musd-btc-lp/intent";
import { entryPreview } from "@/lib/routes/musd-btc-lp/preview";
import { useLpRouteSnapshot } from "@/lib/routes/musd-btc-lp/useLpRouteSnapshot";
import { balanceRecoveries } from "@/lib/routes/balance-recovery";
import { spDepositQuery } from "@/lib/stability-pool/intent";
import { borrowLimit, isRecoveryMode } from "@/lib/trove/borrow";
import { walletCapabilities } from "@/lib/wallet/capabilities";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { balanceNoticeActions, BlockNotice } from "./BlockNotice";
import { lpExposureRow, lpReceive, priceImpactRow } from "./entry-rows";
import { EntryPreviewCard } from "./EntryPreviewCard";
import { LpEntryCard } from "./LpEntryCard";
import { ModeToggle } from "./ModeToggle";
import { NoExecutorCard } from "./NoExecutorCard";
import { PlannerComparison } from "./PlannerComparison";
import { RisksCard } from "./RisksCard";
import { StakeSwitch } from "./StakeToggle";
import { troveChangeRows } from "./troveChange";
import { btc, btcFine, musd } from "./units";

/** Below one unit of the eight decimals shown, the reserve line would only say "<0.00000001 BTC". */
const MIN_SHOWN_RESERVE = 10n ** 10n;

/**
 * Spec §9 screen 2a; U11 §6.2: one action card (amount, receive, stake, overview, Review), then Details.
 * U13: the planner is the app's front door, so it quotes the chain before a wallet connects. The wallet gates only
 * sending: without one the primary action connects, and the card's own gate is not shown.
 */
export default function LpRoutePage() {
  const { address, status } = useAccount();
  const { network } = useNetwork();
  // A remembered wallet reconnecting on load keeps the loading card: the planner must not flash Connect at it.
  if (status === "reconnecting") return <FlowState><LoadingCard label="Connecting wallet" lines={2} /></FlowState>;
  if (!network.executor) return <FlowState><NoExecutorCard /></FlowState>;
  return <LpRouteForm account={address} executor={network.executor.address} />;
}

function LpRouteForm({ account, executor }: { account: Address | undefined; executor: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const searchParams = useSearchParams();
  const [intent, setIntent] = useState<EntryIntent>(() => parseEntryIntent(searchParams));
  const connected = account !== undefined;
  const { data, error, refresh } = useLpRouteSnapshot(account, executor);
  const mezoPrice = useMezoPrice(network, data?.snapshot.blockNumber);

  function update(next: Pick<EntryIntent, "amount" | "slippageBps" | "mode" | "stake" | "asset">) {
    const query = entryQuery(next);
    setIntent(parseEntryIntent(new URLSearchParams(query)));
    window.history.replaceState(null, "", query);
  }

  if (!data) {
    return error ? (
      <FlowState><LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} /></FlowState>
    ) : (
      <FlowState><LoadingCard label="Loading the pool" /></FlowState>
    );
  }

  // Borrow & Deploy needs a wallet and a Trove, so before connecting the planner quotes a plain deposit; the URL keeps
  // the user's mode, and the choice applies the moment the wallet connects.
  const displayIntent: EntryIntent = connected || intent.mode === "deposit" ? intent : { ...intent, mode: "deposit" };
  // The route page refetches every 15 s, so its quote never expires here; the confirm page checks age.
  const preview = entryPreview({
    network,
    data,
    intent: displayIntent,
    walletKind: walletKind ?? "unknown",
    walletChainId: chainId,
    now: data.fetchedAt,
  });
  // U13: the wallet's verdicts and the network warning appear only once there is a wallet to blame them on.
  const view = plannerView({ connected, block: preview.block, walletChainId: chainId, chainId: network.chainId });

  // The entry's quote and its minimum LP, whichever token it brings.
  const quote = preview.btcQuote ?? preview.quote;
  const minLpOut = (preview.btcMinimums ?? preview.minimums)?.minLpOut;
  const fromBtc = intent.asset === "btc";
  const amount = (value: bigint) => (fromBtc ? btcFine(value) : musd(value));
  // This week's rate, only while the week pays: between weeks there is no rate to show.
  const { gauge } = data.snapshot;
  // The header's APR needs no amount (this week's rate on the staked value); the MEZO a week does.
  const open = preview.stake.availability === "open" && gauge !== null;
  const weekly = open && quote !== null ? mezoPerWeek(gauge.rewardRate, quote.liquidity, gauge.totalStaked) : null;
  const apr = open
    ? emissionsApr({
        rewardRate: gauge.rewardRate,
        mezoPrice,
        userLp: quote?.liquidity ?? 0n,
        totalStaked: gauge.totalStaked,
        pool: {
          reserveMusd: data.snapshot.pool.reserveMusd,
          reserveBtc: data.snapshot.pool.reserveBtc,
          balanceMusd: data.snapshot.pool.reserveMusd,
          balanceBtc: data.snapshot.pool.reserveBtc,
          totalSupply: data.snapshot.pool.totalSupply,
        },
      })
    : null;
  const { dashboard } = data.snapshot;
  const exposureChange = preview.after ? exposure(preview.after).totalBtc - exposure(dashboard).totalBtc : null;
  // U17 §1: the BTC this entry adds and what a 30% fall does to it are decision rows again (U12 had them in Details);
  // the Trove change and the network fee stay in Details.
  const hasQuote = quote !== null && minLpOut !== undefined;
  // What went in, in MUSD: a BTC entry's amount at the oracle price.
  const putIn = fromBtc ? ((intent.btcIn ?? 0n) * dashboard.price) / WAD : (intent.musdIn ?? 0n);
  const worth = quote ? entryWorth(quote, dashboard.price, putIn) : null;
  const stakeRow = stakeRowCopy({
    availability: preview.stake.availability,
    on: preview.stake.on,
    mezoPerWeek: weekly,
    aprLabel: apr === null ? null : formatPercent(apr, 1),
    readFailed: dashboard.gaugeReadFailed,
  });
  const overview: OverviewRow[] = hasQuote
    ? [
        { label: "Deposited to the pool", value: musd(quote.musdAdded), sub: `+ ${fromBtc ? btcFine(quote.btcAdded) : btc(quote.btcAdded)}` },
        ...(exposureChange === null ? [] : [lpExposureRow({ exposureChange, worth, fromBtc })]),
        { label: "MezoRoute fee", value: amount(quote.fee), sub: formatBps(data.snapshot.executorFeeBps) },
        priceImpactRow(quote),
        // U14 B2: the Staking row is the stake control (its switch on the value side), not a block of its own.
        ...(stakeRow === null
          ? []
          : [
              {
                label: <Term id="staking">Staking</Term>,
                value: stakeRow.switchable ? <StakeSwitch on={preview.stake.on} onChange={(stake) => update({ ...intent, stake })} /> : "Off",
                sub: stakeRow.sub,
              },
            ]),
      ]
    : [];
  const context: OverviewRow[] = hasQuote
    ? [
        ...(preview.borrow?.trove && preview.borrow.effect
          ? troveChangeRows({ trove: preview.borrow.trove, effect: preview.borrow.effect, price: dashboard.price, mcr: dashboard.protocol.mcr })
          : []),
        { label: "Network fee", value: preview.gasCost === null ? "—" : btc(preview.gasCost) },
      ]
    : [];
  // A shortfall offers Borrow & Deploy (same checks as F4's gate), the wallet's balance, or the Mezo app.
  const recoveries =
    fromBtc && preview.btc && intent.btcIn !== null && (view.block?.reason === "insufficient-balance" || view.block?.reason === "needs-gas")
      ? balanceNoticeActions(
          btcRecoveries({
            amount: intent.btcIn,
            walletBtc: preview.btc.walletBtc,
            reserve: preview.btc.fillReserve ?? preview.btc.walletBtc,
            cap: preview.btc.cap,
            network,
          }),
          { onUseBalance: (value) => update({ ...intent, amount: formatUnits(value, 18) }) },
          "BTC",
        )
      : view.block?.reason === "insufficient-balance" && intent.musdIn !== null
      ? balanceNoticeActions(
          balanceRecoveries({
            route: "lp",
            amount: intent.musdIn,
            walletMusd: dashboard.musd,
            canBorrowAndDeploy: walletCapabilities(walletKind ?? "unknown").borrowAndDeploy,
            borrowLimit: borrowLimit(dashboard.trove, dashboard.price, dashboard.protocol, data.snapshot.maxMusdIn),
            recoveryMode: isRecoveryMode(data.snapshot.system, dashboard.price),
            mezoAppUrl: network.mezoAppUrl,
            cap: data.snapshot.maxMusdIn,
          }),
          {
            onBorrow: (amount) => update({ ...intent, mode: "borrow", amount: formatUnits(amount, 18) }),
            onUseBalance: (amount) => update({ ...intent, amount: formatUnits(amount, 18) }),
          },
        )
      : [];
  // A blocked entry's primary action is the first way out; Review only leads when nothing is blocked.
  const reviewHref = `/route/lp/confirm/${entryQuery(intent)}`;
  const { primary, rest: noticeActions } = splitPrimary(recoveries);
  const primaryAction = !connected
    ? { label: "Connect to review", node: <ConnectCta label="Connect to review" variant="primary" className="w-full" arrow /> }
    : primary
      ? { label: primary.label, href: primary.href, onClick: primary.onClick, external: primary.href !== undefined }
      : { label: "Review", href: reviewHref, disabled: view.block !== null };
  const field = lpAmountField({ preview, mode: displayIntent.mode, asset: intent.asset, walletMusd: dashboard.musd, connected });
  const reserve = preview.btc?.fillReserve;
  // U14 B2: the Borrow & Deploy explainer left the tab row for the field's note.
  const note = !connected
    ? undefined
    : displayIntent.mode === "borrow"
      ? "Borrowed from your Trove and deposited in one transaction."
    : preview.btc && reserve === null
      ? "Max waits for the network fee"
      : reserve != null && reserve >= MIN_SHOWN_RESERVE
        ? `${formatToken(reserve, 18, 8)} BTC stays for the network fee`
        : undefined;
  const header = lpHeaderFigure({
    stakeOn: preview.stake.on,
    availability: preview.stake.availability,
    apr,
    weekly,
    poolFeeBps: dashboard.poolFeeBps,
  });
  // The aside compares the same amount on both routes, from this snapshot; a BTC entry can only compare in MUSD.
  const comparison =
    intent.asset === "btc"
      ? ({ kind: "message", message: BTC_COMPARE_MESSAGE } as const)
      : plannerAmount({ text: intent.amount, musdIn: intent.musdIn, cap: network.entryCap });

  return (
    <FlowColumn
      header={<PageHeader
          back={{ href: "/", label: "Dashboard" }}
          step={1}
          title="Add liquidity"
          subtitle="Collect swap fees or MEZO in the MUSD/BTC pool"
        />}
      aside={
        <>
          {displayIntent.mode === "deposit" && (
            <PlannerComparison
              amountMusd={comparison.kind === "rows" ? comparison.amountMusd : 0n}
              example={comparison.kind === "rows" && comparison.example}
              state={
                comparison.kind === "rows"
                  ? { kind: "rows", rows: plannerComparisonRows({ stake: preview.stake, apr, weekly, poolFeeBps: dashboard.poolFeeBps }) }
                  : comparison
              }
              spHref={comparison.kind === "rows" ? `/route/stability-pool/${spDepositQuery(comparison.amountText)}` : null}
            />
          )}
          <BeforeYouSign
            facts={lpSignFacts(network, { feeBps: data.snapshot.executorFeeBps, capMusd: data.snapshot.maxMusdIn, blockNumber: data.snapshot.blockNumber })}
          />
        </>
      }
    >
      {view.wrongNetwork && <WrongNetworkAlert />}
      <LpEntryCard
        header={header}
        tabs={
          <ModeToggle
            walletKind={walletKind}
            hasTrove={dashboard.trove !== null}
            mode={displayIntent.mode}
            connected={connected}
            onChange={(mode) => update({ ...intent, mode, asset: mode === "borrow" ? "musd" : intent.asset })}
          />
        }
        slippageBps={intent.slippageBps}
        onSlippage={(slippageBps) => update({ ...intent, slippageBps })}
        field={{
          ...field,
          error: lpFieldError(view.block),
          amount: intent.amount,
          note,
          onAmount: (next) => update({ ...intent, amount: next }),
          onToken: displayIntent.mode === "borrow" ? undefined : (token) => update({ ...intent, asset: token === "btc" ? "btc" : "musd", amount: "" }),
        }}
        receive={quote && worth && minLpOut !== undefined ? lpReceive({ worth, liquidity: quote.liquidity, minLpOut, putInLabel: amount(fromBtc ? (intent.btcIn ?? 0n) : (intent.musdIn ?? 0n)) }) : null}
        overview={overview}
        context={context}
        notices={
          <>
            {intent.slippageBps === 200n && (
              <Notice tone="warning">2% slippage lets this deposit fill up to 2% below the quote. Use it only if lower settings keep failing.</Notice>
            )}
            <BlockNotice block={view.block && isFieldBlock(view.block.reason) ? { outcome: null } : view.block} actions={noticeActions} />
          </>
        }
        risk={lpRiskLine({ borrow: displayIntent.mode === "borrow", fromBtc })}
        action={primaryAction}
        details={
          <>
            {quote && <EntryPreviewCard quote={quote} feeBps={data.snapshot.executorFeeBps} borrowFee={preview.borrow?.effect?.fee} stake={preview.stake.on} />}
            {preview.after && <ExposurePanel snapshot={preview.after} before={dashboard} title="BTC exposure after this deposit" fromBtc={fromBtc} />}
            <RisksCard borrow={displayIntent.mode === "borrow"} fromBtc={fromBtc} />
          </>
        }
      />
    </FlowColumn>
  );
}
