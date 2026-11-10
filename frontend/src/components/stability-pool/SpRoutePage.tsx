"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount } from "wagmi";
import { ExposurePanel } from "@/components/dashboard/ExposurePanel";
import { ConnectPage } from "@/components/home/ConnectPage";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { FlowColumn } from "@/components/flow/FlowColumn";
import type { OverviewRow } from "@/components/flow/Overview";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingCard } from "@/components/ui/Skeleton";
import { Term } from "@/components/ui/Term";
import { balanceNoticeActions, BlockNotice } from "@/components/lp/BlockNotice";
import { btc, musd } from "@/components/lp/units";
import { useNetwork } from "@/lib/config/network-context";
import { parseMusdAmount } from "@/lib/quote/amount";
import { spDepositQuery } from "@/lib/stability-pool/intent";
import { spDepositPreview } from "@/lib/stability-pool/preview";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { balanceRecoveries } from "@/lib/routes/balance-recovery";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { SpEntryCard } from "./SpEntryCard";
import { SpRisksCard } from "./SpRisksCard";

/** Spec §9 screen 2b; U11 §6.2: one action card (amount, overview, Review), then exposure and risks in Details. */
export default function SpRoutePage() {
  return (
    <RequireWallet
      fallback={
        <ConnectPage
          back={{ href: "/", label: "Dashboard" }}
          step={1}
          title={
            <>
              Back the system in the <Term id="stabilityPool">Stability Pool</Term>
            </>
          }
          cardTitle="Stability Pool"
          cardNote="Your MUSD repays liquidated debt; you receive the liquidated BTC collateral."
        />
      }
    >
      {(account) => <SpRoute account={account} />}
    </RequireWallet>
  );
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

  const onAmount = (next: string) => {
    setAmount(next);
    window.history.replaceState(null, "", spDepositQuery(next) || window.location.pathname);
  };

  const musdIn = parseMusdAmount(amount);
  const preview = spDepositPreview({ network, data, musdIn, walletKind: walletKind ?? "unknown", walletChainId: chainId });
  const dashboard = data.snapshot.dashboard;
  // The current deposit and pending gain show before an amount is typed (U1 deferred: they waited for one).
  const rows: OverviewRow[] = [
    ...(musdIn !== null && preview.depositAfter !== null ? [{ label: "Deposit after (estimated)", value: musd(preview.depositAfter) }] : []),
    { label: "Your deposit now", value: musd(preview.depositNow) },
    {
      label: (
        <>
          Pending <Term id="btcGain">BTC gain</Term>
        </>
      ),
      value: btc(preview.gainPaid),
      sub: "Paid to your wallet with this deposit",
    },
    { label: "MezoRoute fee", value: "None (direct protocol call)" },
    { label: "Network fee (estimated)", value: preview.gasCost === null ? "—" : btc(preview.gasCost) },
  ];
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
          { onUseBalance: (balance) => onAmount(formatUnits(balance, 18)) },
        )
      : [];
  return (
    <FlowColumn
      header={
        <PageHeader
          back={{ href: "/", label: "Dashboard" }}
          step={1}
          title={
            <>
              Back the system in the <Term id="stabilityPool">Stability Pool</Term>
            </>
          }
        />
      }
    >
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <SpEntryCard
        field={{ amount, onAmount, balance: dashboard.musd }}
        overview={rows}
        notices={<BlockNotice block={preview.block} actions={recoveries} />}
        review={{ href: `/route/stability-pool/confirm/${spDepositQuery(amount)}`, disabled: preview.block !== null }}
        details={
          <>
            <p className="text-sm text-muted">Your MUSD repays liquidated debt; in return you receive the liquidated BTC collateral.</p>
            {preview.after && <ExposurePanel snapshot={preview.after} before={dashboard} title="BTC exposure after this deposit" />}
            <SpRisksCard />
          </>
        }
      />
    </FlowColumn>
  );
}
