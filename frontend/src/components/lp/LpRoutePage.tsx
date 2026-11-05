"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount } from "wagmi";
import { ExposurePanel } from "@/components/dashboard/ExposurePanel";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { MobileBar, RouteLayout } from "@/components/route/RouteLayout";
import { SummaryPanel, type SummaryRow } from "@/components/route/SummaryPanel";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingCard } from "@/components/ui/Skeleton";
import { useNetwork } from "@/lib/config/network-context";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { emissionsApr, mezoPerWeek } from "@/lib/gauge/maths";
import { useMezoPrice } from "@/lib/gauge/useMezoPrice";
import { btcRecoveries, type EntryAsset } from "@/lib/routes/musd-btc-lp/asset";
import { entryQuery, parseEntryIntent, type EntryIntent } from "@/lib/routes/musd-btc-lp/intent";
import { entryPreview } from "@/lib/routes/musd-btc-lp/preview";
import { useLpRouteSnapshot } from "@/lib/routes/musd-btc-lp/useLpRouteSnapshot";
import { balanceRecoveries } from "@/lib/routes/balance-recovery";
import { borrowLimit, isRecoveryMode } from "@/lib/trove/borrow";
import { walletCapabilities } from "@/lib/wallet/capabilities";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { AmountForm } from "./AmountForm";
import { balanceNoticeActions, BlockNotice } from "./BlockNotice";
import { EntryPreviewCard } from "./EntryPreviewCard";
import { ModeToggle } from "./ModeToggle";
import { NoExecutorCard } from "./NoExecutorCard";
import { RisksCard } from "./RisksCard";
import { StakeToggle } from "./StakeToggle";
import { TroveChangeCard } from "./TroveChangeCard";
import { btc, btcFine, lp, musd } from "./units";

/** Below one unit of the eight decimals shown, the reserve line would only say "<0.00000001 BTC". */
const MIN_SHOWN_RESERVE = 10n ** 10n;

/** Spec §9 screen 2a: amount, preview, exposure before/after, risks, Review. */
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
  const open = preview.stake.availability === "open" && gauge !== null && quote !== null;
  const weekly = open ? mezoPerWeek(gauge.rewardRate, quote.liquidity, gauge.totalStaked) : null;
  const apr = open
    ? emissionsApr({
        rewardRate: gauge.rewardRate,
        mezoPrice,
        userLp: quote.liquidity,
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
  const rows: SummaryRow[] =
    quote && minLpOut !== undefined
      ? [
          {
            label: preview.borrow ? "You borrow and deposit" : "You deposit",
            value: "btcIn" in quote ? btcFine(quote.btcIn) : musd(quote.musdIn),
            strong: true,
          },
          { label: "You receive", value: `≈ ${lp(quote.liquidity)}`, sub: `at least ${lp(minLpOut)}`, strong: true },
          { label: "Deposited to the pool", value: musd(quote.musdAdded), sub: `+ ${fromBtc ? btcFine(quote.btcAdded) : btc(quote.btcAdded)}` },
          { label: "MezoRoute fee", value: amount(quote.fee), sub: formatBps(data.snapshot.executorFeeBps) },
          { label: "Price impact", value: formatPercent(quote.priceImpact, 2), sub: "includes the pool's swap fee" },
          ...(preview.stake.availability === "unavailable"
            ? []
            : [{ label: "Staking", value: preview.stake.on ? "In the MEZO gauge" : "Off", sub: preview.stake.on ? "swap fees go to veBTC voters" : undefined }]),
          { label: "Network fee", value: preview.gasCost === null ? "—" : btc(preview.gasCost) },
        ]
      : [];
  const review = (className?: string) => (
    <ButtonLink href={`/route/lp/confirm/${entryQuery(intent)}`} disabled={preview.block !== null} className={className} arrow>
      Review
    </ButtonLink>
  );
  const { dashboard } = data.snapshot;
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
  const notice = preview.block?.outcome ? <BlockNotice block={preview.block} actions={recoveries} /> : undefined;

  return (
    <RouteLayout
      header={<PageHeader back={{ href: "/", label: "Dashboard" }} step={1} title="Earn swap fees or MEZO in the MUSD/BTC pool" />}
      summary={<SummaryPanel rows={rows} notice={notice} action={review("w-full")} />}
      mobileBar={<MobileBar figure={quote ? `≈ ${lp(quote.liquidity)}` : undefined} notice={notice} action={review()} />}
    >
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <Card>
        <ModeToggle
          walletKind={walletKind}
          hasTrove={data.snapshot.dashboard.trove !== null}
          mode={intent.mode}
          onChange={(mode) => update({ ...intent, mode, asset: mode === "borrow" ? "musd" : intent.asset })}
        />
        <AmountForm
          amount={intent.amount}
          slippageBps={intent.slippageBps}
          max={preview.btc ? preview.btc.maxSpendable : preview.borrow ? preview.borrow.limit : data.snapshot.dashboard.musd}
          balance={preview.btc ? preview.btc.walletBtc : undefined}
          note={preview.btc?.fillReserve != null && preview.btc.fillReserve >= MIN_SHOWN_RESERVE ? `${formatToken(preview.btc.fillReserve, 18, 8)} BTC stays for the network fee` : undefined}
          maxLabel={preview.borrow ? "You can borrow" : "In your wallet"}
          asset={intent.asset}
          onAsset={intent.mode === "borrow" ? undefined : (asset: EntryAsset) => update({ ...intent, asset, amount: "" })}
          onChange={(next) => update({ ...next, mode: intent.mode, stake: intent.stake, asset: intent.asset })}
        />
      </Card>
      <StakeToggle
        availability={preview.stake.availability}
        on={preview.stake.on}
        onChange={(stake) => update({ ...intent, stake })}
        mezoPerWeek={weekly}
        aprLabel={apr === null ? null : formatPercent(apr, 1)}
      />
      {quote && <EntryPreviewCard quote={quote} feeBps={data.snapshot.executorFeeBps} borrowFee={preview.borrow?.effect?.fee} stake={preview.stake.on} />}
      {preview.borrow?.trove && preview.borrow.effect && (
        <TroveChangeCard
          trove={preview.borrow.trove}
          effect={preview.borrow.effect}
          price={data.snapshot.dashboard.price}
          mcr={data.snapshot.dashboard.protocol.mcr}
        />
      )}
      {preview.after && <ExposurePanel snapshot={preview.after} before={data.snapshot.dashboard} title="BTC exposure after this deposit" />}
      <RisksCard borrow={intent.mode === "borrow"} fromBtc={fromBtc} />
    </RouteLayout>
  );
}
