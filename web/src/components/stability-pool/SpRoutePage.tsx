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
import { AmountInput } from "@/components/lp/AmountInput";
import { balanceNoticeActions, BlockNotice } from "@/components/lp/BlockNotice";
import { btc, musd } from "@/components/lp/units";
import { useNetwork } from "@/lib/config/network-context";
import { parseMusdAmount } from "@/lib/quote/amount";
import { spDepositQuery } from "@/lib/stability-pool/intent";
import { spDepositPreview } from "@/lib/stability-pool/preview";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { balanceRecoveries } from "@/lib/routes/balance-recovery";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { SpRisksCard } from "./SpRisksCard";

/** Spec §9 screen 2b: amount, current deposit and pending BTC gain, exposure before/after, risks, Review. */
export default function SpRoutePage() {
  return <RequireWallet>{(account) => <SpRoute account={account} />}</RequireWallet>;
}

function SpRoute({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const searchParams = useSearchParams();
  const [amount, setAmount] = useState(() => searchParams.get("amount") ?? "");
  const { data, error, refresh } = useSpSnapshot(account);

  if (!data) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <LoadingCard label="Loading the Stability Pool" />
    );
  }

  const musdIn = parseMusdAmount(amount);
  const preview = spDepositPreview({ network, data, musdIn, walletKind: walletKind ?? "unknown", walletChainId: chainId });
  const dashboard = data.snapshot.dashboard;
  const rows: SummaryRow[] =
    musdIn === null
      ? []
      : [
          { label: "You deposit", value: musd(musdIn), strong: true },
          ...(preview.depositAfter !== null ? [{ label: "Deposit after (estimated)", value: musd(preview.depositAfter), strong: true }] : []),
          { label: "Your deposit now", value: musd(preview.depositNow) },
          { label: "Pending BTC gain", value: btc(preview.gainPaid), sub: "Paid to your wallet with this deposit" },
          { label: "MezoRoute fee", value: "None (direct protocol call)" },
          { label: "Network fee (estimated)", value: preview.gasCost === null ? "—" : btc(preview.gasCost) },
        ];
  const review = (className?: string) => (
    <ButtonLink href={`/route/stability-pool/confirm/${spDepositQuery(amount)}`} disabled={preview.block !== null} className={className}>
      Review
    </ButtonLink>
  );
  const recoveries =
    preview.block?.reason === "insufficient-balance" && musdIn !== null
      ? balanceNoticeActions(
          balanceRecoveries({
            route: "sp",
            amount: musdIn,
            walletMusd: dashboard.musd,
            canBorrowAndDeploy: false,
            borrowLimit: 0n,
            recoveryMode: false,
            mezoAppUrl: network.mezoAppUrl,
          }),
          { onUseBalance: (balance) => setAmount(formatUnits(balance, 18)) },
        )
      : [];
  const notice = preview.block?.outcome ? <BlockNotice block={preview.block} actions={recoveries} /> : undefined;

  return (
    <RouteLayout
      header={<PageHeader back={{ href: "/", label: "Dashboard" }} step={1} title="Back the system in the Stability Pool" />}
      summary={<SummaryPanel rows={rows} notice={notice} action={review("w-full")} />}
      mobileBar={<MobileBar figure={musdIn === null ? undefined : musd(musdIn)} notice={notice} action={review()} />}
    >
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <Card subtitle="Your MUSD repays liquidated debt; in return you receive the liquidated BTC collateral.">
        <div className="mt-4">
          <AmountInput
            amount={amount}
            max={dashboard.musd}
            maxLabel="In your wallet"
            onAmount={(next) => {
              setAmount(next);
              window.history.replaceState(null, "", spDepositQuery(next) || window.location.pathname);
            }}
          />
        </div>
      </Card>
      {preview.after && <ExposurePanel snapshot={preview.after} before={dashboard} title="BTC exposure after this deposit" />}
      <SpRisksCard />
    </RouteLayout>
  );
}
