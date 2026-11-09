"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount } from "wagmi";
import { ExposurePanel } from "@/components/dashboard/ExposurePanel";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { FlowColumn } from "@/components/flow/FlowColumn";
import type { OverviewRow } from "@/components/flow/Overview";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingCard } from "@/components/ui/Skeleton";
import { useNetwork } from "@/lib/config/network-context";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { emissionsApr, mezoPerWeek } from "@/lib/gauge/maths";
import { useMezoPrice } from "@/lib/gauge/useMezoPrice";
import { exposure } from "@/lib/exposure/exposure";
import { lpAmountField, lpHeaderFigure, lpRiskLine } from "@/lib/flow/lp-entry";
import { splitPrimary } from "@/lib/flow/notice-action";
import { btcRecoveries } from "@/lib/routes/musd-btc-lp/asset";
import { entryQuery, parseEntryIntent, type EntryIntent } from "@/lib/routes/musd-btc-lp/intent";
import { entryPreview } from "@/lib/routes/musd-btc-lp/preview";
import { useLpRouteSnapshot } from "@/lib/routes/musd-btc-lp/useLpRouteSnapshot";
import { balanceRecoveries } from "@/lib/routes/balance-recovery";
import { borrowLimit, isRecoveryMode } from "@/lib/trove/borrow";
import { walletCapabilities } from "@/lib/wallet/capabilities";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { balanceNoticeActions, BlockNotice } from "./BlockNotice";
import { EntryPreviewCard } from "./EntryPreviewCard";
import { LpEntryCard } from "./LpEntryCard";
import { ModeToggle } from "./ModeToggle";
import { NoExecutorCard } from "./NoExecutorCard";
import { RisksCard } from "./RisksCard";
import { StakeToggle } from "./StakeToggle";
import { troveChangeRows } from "./troveChange";
import { btc, btcFine, lp, musd } from "./units";

/** Below one unit of the eight decimals shown, the reserve line would only say "<0.00000001 BTC". */
const MIN_SHOWN_RESERVE = 10n ** 10n;

/** Spec §9 screen 2a; U11 §6.2: one action card (amount, receive, stake, overview, Review), then Details. */
export default function LpRoutePage() {
  return <RequireWallet>{(account) => <LpRoute account={account} />}</RequireWallet>;
}

function LpRoute({ account }: { account: Address }) {
  const { network } = useNetwork();
  if (!network.executor) return <NoExecutorCard />;
  return <LpRouteForm account={account} executor={network.executor.address} />;
}

function LpRouteForm({ account, executor }: { account: Address; executor: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const searchParams = useSearchParams();
  const [intent, setIntent] = useState<EntryIntent>(() => parseEntryIntent(searchParams));
  const { data, error, refresh } = useLpRouteSnapshot(account, executor);
  const mezoPrice = useMezoPrice(network, data?.snapshot.blockNumber);

  function update(next: Pick<EntryIntent, "amount" | "slippageBps" | "mode" | "stake" | "asset">) {
    const query = entryQuery(next);
    setIntent(parseEntryIntent(new URLSearchParams(query)));
    window.history.replaceState(null, "", query);
  }

  if (!data) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <LoadingCard label="Loading the pool" />
    );
  }

  // The route page refetches every 15 s, so its quote never expires here; the confirm page checks age.
  const preview = entryPreview({
    network,
    data,
    intent,
    walletKind: walletKind ?? "unknown",
    walletChainId: chainId,
    now: data.fetchedAt,
  });

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
  // U12: four rows decide the entry; BTC exposure, the Trove change, and the network fee sit in Details.
  const hasQuote = quote !== null && minLpOut !== undefined;
  const overview: OverviewRow[] = hasQuote
    ? [
        { label: "Deposited to the pool", value: musd(quote.musdAdded), sub: `+ ${fromBtc ? btcFine(quote.btcAdded) : btc(quote.btcAdded)}` },
        { label: "MezoRoute fee", value: amount(quote.fee), sub: formatBps(data.snapshot.executorFeeBps) },
        { label: "Price impact", value: formatPercent(quote.priceImpact, 2), sub: "includes the pool's swap fee" },
        ...(preview.stake.availability === "unavailable"
          ? []
          : [{ label: "Staking", value: preview.stake.on ? "In the MEZO gauge" : "Off", sub: preview.stake.on ? "swap fees go to veBTC voters" : undefined }]),
      ]
    : [];
  const context: OverviewRow[] = hasQuote
    ? [
        ...(exposureChange === null
          ? []
          : [
              {
                label: "BTC exposure",
                value: `${exposureChange < 0n ? "−" : "+"}${btc(exposureChange < 0n ? -exposureChange : exposureChange)}`,
                sub: fromBtc ? "pool share only; the BTC you deposit leaves your wallet" : undefined,
                tone: "btc" as const,
              },
            ]),
        ...(preview.borrow?.trove && preview.borrow.effect
          ? troveChangeRows({ trove: preview.borrow.trove, effect: preview.borrow.effect, price: dashboard.price, mcr: dashboard.protocol.mcr })
          : []),
        { label: "Network fee", value: preview.gasCost === null ? "—" : btc(preview.gasCost) },
      ]
    : [];
  // A shortfall offers Borrow & Deploy (same checks as F4's gate), the wallet's balance, or the Mezo app.
  const recoveries =
    fromBtc && preview.btc && intent.btcIn !== null && (preview.block?.reason === "insufficient-balance" || preview.block?.reason === "needs-gas")
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
      : preview.block?.reason === "insufficient-balance" && intent.musdIn !== null
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
  const primaryAction = primary
    ? { label: primary.label, href: primary.href, onClick: primary.onClick, external: primary.href !== undefined }
    : { label: "Review", href: reviewHref, disabled: preview.block !== null };
  const field = lpAmountField({ preview, mode: intent.mode, asset: intent.asset, walletMusd: dashboard.musd });
  const reserve = preview.btc?.fillReserve;
  const note =
    preview.btc && reserve === null
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

  return (
    <FlowColumn header={<PageHeader
        back={{ href: "/", label: "Dashboard" }}
        step={1}
        title="Add liquidity"
        subtitle="Earn swap fees or MEZO in the MUSD/BTC pool"
      />}>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <LpEntryCard
        header={header}
        tabs={
          <ModeToggle
            walletKind={walletKind}
            hasTrove={dashboard.trove !== null}
            mode={intent.mode}
            onChange={(mode) => update({ ...intent, mode, asset: mode === "borrow" ? "musd" : intent.asset })}
          />
        }
        slippageBps={intent.slippageBps}
        onSlippage={(slippageBps) => update({ ...intent, slippageBps })}
        field={{
          ...field,
          amount: intent.amount,
          note,
          onAmount: (next) => update({ ...intent, amount: next }),
          onToken: intent.mode === "borrow" ? undefined : (token) => update({ ...intent, asset: token === "btc" ? "btc" : "musd", amount: "" }),
        }}
        receive={quote && minLpOut !== undefined ? { value: `≈ ${lp(quote.liquidity)}`, minimum: `At least ${lp(minLpOut)}` } : null}
        stake={
          <StakeToggle
            availability={preview.stake.availability}
            on={preview.stake.on}
            onChange={(stake) => update({ ...intent, stake })}
            mezoPerWeek={weekly}
            aprLabel={apr === null ? null : formatPercent(apr, 1)}
            readFailed={dashboard.gaugeReadFailed}
          />
        }
        overview={overview}
        context={context}
        notices={
          <>
            {intent.slippageBps === 200n && (
              <Notice tone="warning">2% slippage lets this deposit fill up to 2% below the quote. Use it only if lower settings keep failing.</Notice>
            )}
            <BlockNotice block={preview.block} actions={noticeActions} />
          </>
        }
        risk={lpRiskLine({ borrow: intent.mode === "borrow", fromBtc })}
        action={primaryAction}
        details={
          <>
            {quote && <EntryPreviewCard quote={quote} feeBps={data.snapshot.executorFeeBps} borrowFee={preview.borrow?.effect?.fee} stake={preview.stake.on} />}
            {preview.after && <ExposurePanel snapshot={preview.after} before={dashboard} title="BTC exposure after this deposit" fromBtc={fromBtc} />}
            <RisksCard borrow={intent.mode === "borrow"} fromBtc={fromBtc} />
          </>
        }
      />
    </FlowColumn>
  );
}
