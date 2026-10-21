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
import { formatBps, formatPercent } from "@/lib/format";
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
import { TroveChangeCard } from "./TroveChangeCard";
import { btc, lp, musd } from "./units";

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

  function update(next: Pick<EntryIntent, "amount" | "slippageBps" | "mode">) {
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

  const quote = preview.quote;
  const rows: SummaryRow[] =
    quote && preview.minimums
      ? [
          { label: preview.borrow ? "You borrow and deposit" : "You deposit", value: musd(quote.musdIn), strong: true },
          { label: "You receive", value: `≈ ${lp(quote.liquidity)}`, sub: `at least ${lp(preview.minimums.minLpOut)}`, strong: true },
          { label: "Deposited to the pool", value: musd(quote.musdAdded), sub: `+ ${btc(quote.btcAdded)}` },
          { label: "MezoRoute fee", value: musd(quote.fee), sub: formatBps(data.snapshot.executorFeeBps) },
          { label: "Price impact", value: formatPercent(quote.priceImpact, 2), sub: "includes the pool's swap fee" },
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
    preview.block?.reason === "insufficient-balance" && intent.musdIn !== null
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
      header={<PageHeader back={{ href: "/", label: "Dashboard" }} step={1} title="Earn swap fees in the MUSD/BTC pool" />}
      summary={<SummaryPanel rows={rows} notice={notice} action={review("w-full")} />}
      mobileBar={<MobileBar figure={quote ? `≈ ${lp(quote.liquidity)}` : undefined} notice={notice} action={review()} />}
    >
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <Card>
        <ModeToggle walletKind={walletKind} hasTrove={data.snapshot.dashboard.trove !== null} mode={intent.mode} onChange={(mode) => update({ ...intent, mode })} />
        <AmountForm
          amount={intent.amount}
          slippageBps={intent.slippageBps}
          max={preview.borrow ? preview.borrow.limit : data.snapshot.dashboard.musd}
          maxLabel={preview.borrow ? "You can borrow" : "In your wallet"}
          onChange={(next) => update({ ...next, mode: intent.mode })}
        />
      </Card>
      {quote && <EntryPreviewCard quote={quote} feeBps={data.snapshot.executorFeeBps} borrowFee={preview.borrow?.effect?.fee} />}
      {preview.borrow?.trove && preview.borrow.effect && (
        <TroveChangeCard
          trove={preview.borrow.trove}
          effect={preview.borrow.effect}
          price={data.snapshot.dashboard.price}
          mcr={data.snapshot.dashboard.protocol.mcr}
        />
      )}
      {preview.after && <ExposurePanel snapshot={preview.after} before={data.snapshot.dashboard} title="BTC exposure after this deposit" />}
      <RisksCard borrow={intent.mode === "borrow"} />
    </RouteLayout>
  );
}
