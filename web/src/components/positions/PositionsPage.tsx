"use client";

import Link from "next/link";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { useNetwork } from "@/lib/config/network-context";
import { lacksGas } from "@/lib/dashboard/readiness";
import { claimBlock } from "@/lib/positions/claim";
import { usePositionsHistory } from "@/lib/positions/usePositionsHistory";
import { usePositionsSnapshot } from "@/lib/positions/usePositionsSnapshot";
import { positionView } from "@/lib/positions/view";
import { FeesCard } from "./FeesCard";
import { LpPositionCard } from "./LpPositionCard";

/** Spec §9 screen 5, LP part (the Stability Pool block arrives with F5). */
export default function PositionsPage() {
  return <RequireWallet>{(account) => <Positions account={account} />}</RequireWallet>;
}

function Positions({ account }: { account: Address }) {
  const { network } = useNetwork();
  const { chainId } = useAccount();
  const { data, error, refresh } = usePositionsSnapshot(account);
  const history = usePositionsHistory(account);

  if (!data) {
    return error ? (
      <LoadError error={error} onRetry={() => void refresh().catch(() => undefined)} />
    ) : (
      <div aria-busy="true" aria-label="Loading your positions" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
    );
  }

  const view = positionView(data.snapshot, history.events ?? null);
  const block = claimBlock({
    network,
    walletChainId: chainId,
    fees: data.snapshot.fees,
    lacksGas: lacksGas(data.gasBalance, data.gasPrice),
  });
  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <h1 className="text-lg font-semibold">Your positions</h1>
      {view.empty ? (
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-sm">You have no MUSD/BTC LP and no unclaimed pool fees on {network.name}.</p>
          <Link href="/route/lp/" className="mt-3 inline-block text-xs font-semibold text-accent hover:underline">
            Deposit MUSD into the pool
          </Link>
        </section>
      ) : (
        <>
          {view.lp.balance > 0n && <LpPositionCard lp={view.lp} history={history} />}
          <FeesCard account={account} fees={view.fees} block={block} />
        </>
      )}
    </>
  );
}
