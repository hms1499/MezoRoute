"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { ExposurePanel } from "@/components/dashboard/ExposurePanel";
import { ConnectCta } from "@/components/home/ConnectCta";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { BeforeYouSign } from "@/components/flow/BeforeYouSign";
import { FlowColumn, FlowState } from "@/components/flow/FlowColumn";
import { amountFieldError, urlAmount } from "@/lib/flow/amount";
import { isFieldBlock, spFieldError } from "@/lib/flow/field-error";
import { plannerAmount, plannerComparisonRows, plannerLpSide } from "@/lib/flow/planner-comparison";
import { spSignFacts, trustLine } from "@/lib/flow/sign-facts";
import type { OverviewRow } from "@/components/flow/Overview";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingCard } from "@/components/ui/Skeleton";
import { Term } from "@/components/ui/Term";
import { balanceNoticeActions, BlockNotice } from "@/components/lp/BlockNotice";
import { PlannerComparison } from "@/components/lp/PlannerComparison";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { compareHref } from "@/lib/compare/default-amount";
import { useNetwork } from "@/lib/config/network-context";
import { effectiveStake, stakeAvailability } from "@/lib/gauge/availability";
import { useMezoPrice } from "@/lib/gauge/useMezoPrice";
import { parseMusdAmount } from "@/lib/quote/amount";
import { spDepositQuery } from "@/lib/stability-pool/intent";
import { spDepositPreview } from "@/lib/stability-pool/preview";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { balanceRecoveries } from "@/lib/routes/balance-recovery";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { PENDING_GAIN_LABEL, spEntryRows } from "./entry-rows";
import { SpEntryCard } from "./SpEntryCard";
import { SpDepositAside } from "./SpDepositAside";
import { SpRisksCard } from "./SpRisksCard";

/**
 * Spec §9 screen 2b; U11 §6.2: one action card (amount, overview, Review), then exposure and risks in Details.
 * U17 §5: like the LP planner (U13), the page reads the chain before a wallet connects. The wallet gates only
 * sending: without one the primary action connects, and nothing is shown as the visitor's.
 */
export default function SpRoutePage() {
  const { address, status } = useAccount();
  // A remembered wallet reconnecting on load keeps the loading card: the planner must not flash Connect at it.
  if (status === "reconnecting") return <FlowState><LoadingCard label="Connecting wallet" lines={2} /></FlowState>;
  return <SpRoute account={address} />;
}

function SpRoute({ account }: { account: Address | undefined }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const walletKind = useWalletKind();
  const searchParams = useSearchParams();
  const [amount, setAmount] = useState(() => searchParams.get("amount") ?? "");
  const connected = account !== undefined;
  const { data, error, refresh } = useSpSnapshot(account);
  const mezoPrice = useMezoPrice(network, data?.snapshot.blockNumber);
  // U17 review: the LP side's quote is made with the executor's own fee, as on the LP planner (which reads it in its
  // snapshot), so both pages quote from the chain; the pinned value only fills the gap while the read is in flight.
  const { data: chainExecutorFee } = useReadContract({
    chainId: network.chainId,
    address: network.executor?.address,
    abi: mezoRouteExecutorAbi,
    functionName: "feeBps",
    query: { enabled: network.executor !== null },
  });
  const executorFeeBps = chainExecutorFee ?? network.executor?.feeBps ?? 0n;

  if (!data) {
    return error ? (
      <FlowState><LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} /></FlowState>
    ) : (
      <FlowState><LoadingCard label="Loading the Stability Pool" /></FlowState>
    );
  }

  const onAmount = (next: string) => {
    setAmount(next);
    // U17: the URL never carries text that cannot be an amount.
    window.history.replaceState(null, "", spDepositQuery(urlAmount(next)) || window.location.pathname);
  };

  const musdIn = parseMusdAmount(amount);
  const preview = spDepositPreview({ network, data, musdIn, walletKind: walletKind ?? "unknown", walletChainId: chainId });
  const { snapshot } = data;
  const dashboard = snapshot.dashboard;
  // The wallet's verdicts appear only once there is a wallet to blame them on; the pool refuses no amount by itself.
  const block = connected ? preview.block : null;
  const rows: OverviewRow[] = spEntryRows({ connected, musdIn, preview }).map((row) =>
    row.label === PENDING_GAIN_LABEL
      ? {
          ...row,
          label: (
            <>
              Pending <Term id="btcGain">BTC gain</Term>
            </>
          ),
        }
      : row,
  );
  const recoveries =
    block?.reason === "insufficient-balance" && musdIn !== null
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

  // U17 §2: the same comparison as the LP planner's, from this snapshot's pool: the same amount reads the same there.
  const comparison = plannerAmount({ text: amount, musdIn, cap: network.entryCap });
  const pool = { reserveMusd: dashboard.lp.reserveMusd, reserveBtc: dashboard.lp.reserveBtc, totalSupply: dashboard.lp.totalSupply, feeBps: dashboard.poolFeeBps };
  const availability = stakeAvailability(snapshot.gauge, snapshot.blockTimestamp);
  const lpSide =
    comparison.kind === "rows"
      ? plannerLpSide({ pool, price: dashboard.price, amountMusd: comparison.amountMusd, executorFeeBps, gauge: snapshot.gauge, availability, mezoPrice })
      : null;
  const facts = spSignFacts(network, snapshot.blockNumber);

  return (
    <FlowColumn
      aside={
        <>
          <PlannerComparison
            amountMusd={comparison.kind === "rows" ? comparison.amountMusd : 0n}
            example={comparison.kind === "rows" && comparison.example}
            state={
              comparison.kind === "rows"
                ? {
                    kind: "rows",
                    rows: plannerComparisonRows({
                      amountMusd: comparison.amountMusd,
                      // The LP planner stakes by default; the comparison shows what "Choose MUSD/BTC LP" leads to.
                      stake: { availability, on: effectiveStake(true, availability) },
                      apr: lpSide?.apr ?? null,
                      weekly: lpSide?.weekly ?? null,
                      poolFeeBps: dashboard.poolFeeBps,
                      lp: lpSide?.lp ?? null,
                    }),
                  }
                : comparison
            }
            other="lp"
            otherHref={comparison.kind === "rows" ? `/route/lp/?${new URLSearchParams({ amount: comparison.amountText }).toString()}` : null}
            historyHref={compareHref(comparison.kind === "rows" && !comparison.example ? comparison.amountText : "")}
          />
          {/* Without a wallet there is no deposit to show: only what signing gives up. */}
          {connected ? <SpDepositAside sp={dashboard.sp} facts={facts} /> : <BeforeYouSign facts={facts} />}
        </>
      }
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
      {connected && chainId !== undefined && chainId !== network.chainId && <WrongNetworkAlert />}
      <SpEntryCard
        field={{ amount, onAmount, balance: connected ? dashboard.musd : null, error: amountFieldError(amount, "musd") ?? spFieldError(block) }}
        overview={rows}
        notices={<BlockNotice block={block && isFieldBlock(block.reason) ? { outcome: null } : block} actions={recoveries} />}
        review={{ href: `/route/stability-pool/confirm/${spDepositQuery(amount)}`, disabled: block !== null }}
        action={connected ? undefined : <ConnectCta label="Connect to review" variant="primary" className="w-full" arrow />}
        trust={trustLine(facts)}
        details={
          <>
            <p className="text-sm text-muted">Your MUSD repays liquidated debt; in return you receive the liquidated BTC collateral.</p>
            {preview.after && (
              <ExposurePanel
                snapshot={preview.after}
                before={dashboard}
                title="BTC exposure after this deposit"
                // U17 review: "Kept in MUSD" is the value before plus the amount put in, as on the LP planner (equal
                // for a MUSD deposit today, and it stays right if the pool ever charges one).
                putIn={musdIn ?? undefined}
                scope={connected ? "account" : "deposit"}
              />
            )}
            <SpRisksCard />
          </>
        }
      />
    </FlowColumn>
  );
}
