"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { ExposurePanel } from "@/components/dashboard/ExposurePanel";
import { RequireWallet } from "@/components/home/RequireWallet";
import { WrongNetworkAlert } from "@/components/home/WrongNetworkAlert";
import { LoadError } from "@/components/LoadError";
import { AmountInput } from "@/components/lp/AmountInput";
import { BlockNotice } from "@/components/lp/BlockNotice";
import { ExposureChange } from "@/components/lp/ExposureChange";
import { useNetwork } from "@/lib/config/network-context";
import { parseMusdAmount } from "@/lib/quote/amount";
import { spDepositQuery } from "@/lib/stability-pool/intent";
import { spDepositPreview } from "@/lib/stability-pool/preview";
import { useSpSnapshot } from "@/lib/stability-pool/useSpSnapshot";
import { useWalletKind } from "@/lib/wallet/useWalletKind";
import { SpDepositCard } from "./SpDepositCard";
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
      <div aria-busy="true" aria-label="Loading the Stability Pool" className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
    );
  }

  const musdIn = parseMusdAmount(amount);
  const preview = spDepositPreview({ network, data, musdIn, walletKind: walletKind ?? "unknown", walletChainId: chainId });
  const dashboard = data.snapshot.dashboard;
  return (
    <>
      {chainId !== network.chainId && <WrongNetworkAlert />}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h1 className="text-lg font-semibold">Back the system in the Stability Pool</h1>
        <p className="mt-1 text-sm text-muted">
          Your MUSD repays liquidated debt; in return you receive the liquidated BTC collateral.
        </p>
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
      </section>
      <SpDepositCard preview={preview} />
      {preview.after && <ExposureChange before={dashboard} after={preview.after} />}
      {preview.after && <ExposurePanel snapshot={preview.after} title="BTC exposure after this deposit" />}
      <SpRisksCard />
      <div className="flex items-center justify-between gap-3">
        <BlockNotice block={preview.block} />
        {preview.block ? (
          <span aria-disabled="true" className="ml-auto rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white opacity-50">
            Review
          </span>
        ) : (
          <Link
            href={`/route/stability-pool/confirm/${spDepositQuery(amount)}`}
            className="ml-auto rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Review
          </Link>
        )}
      </div>
    </>
  );
}
