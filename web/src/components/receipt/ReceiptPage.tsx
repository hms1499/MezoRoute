"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { Address, Hash, TransactionReceipt } from "viem";
import { useAccount, useConfig } from "wagmi";
import { StatRow } from "@/components/dashboard/StatRow";
import { ExternalButton } from "@/components/ExternalButton";
import { useNetwork } from "@/lib/config/network-context";
import { explorerTxUrl } from "@/lib/config/networks";
import { decodeError } from "@/lib/errors/decode";
import { useDashboardSnapshot } from "@/lib/dashboard/useDashboardSnapshot";
import { formatPercent, formatToken, shortAddress } from "@/lib/format";
import { claimRows } from "@/lib/positions/claim";
import { enteredRows, exitedRows } from "@/lib/routes/musd-btc-lp/receipt";
import { spReceiptRows } from "@/lib/stability-pool/receipt";
import { collateralRatio } from "@/lib/trove/health";
import { receiptKind } from "@/lib/tx/receipt-kind";
import { confirmCall, isTxHash } from "@/lib/tx/send";

const RECEIPT_KEY = "entry-receipt";

/** Spec §9 screen 4: progress until confirmed, then values from the Entered, Exited, pool Claim, or Stability Pool events only (FR-11, FR-13). */
export default function ReceiptPage() {
  const hash = useSearchParams().get("hash");
  if (!isTxHash(hash)) {
    return (
      <Card>
        <p className="text-sm">This link has no valid transaction hash.</p>
        <BackLink />
      </Card>
    );
  }
  return <Receipt hash={hash} />;
}

function Receipt({ hash }: { hash: Hash }) {
  const { network } = useNetwork();
  const config = useConfig();
  const queryClient = useQueryClient();
  const receipt = useQuery({
    queryKey: [RECEIPT_KEY, network.chainId, hash],
    queryFn: () => confirmCall(config, hash, network.chainId),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // FR-02: balances refresh after a confirmed transaction.
  useEffect(() => {
    if (receipt.isSuccess) {
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== RECEIPT_KEY });
    }
  }, [receipt.isSuccess, queryClient]);

  const explorer = explorerTxUrl(network, receipt.data?.transactionHash ?? hash);
  return (
    <Card>
      {receipt.isPending && (
        <>
          <h1 className="text-lg font-semibold">Confirming…</h1>
          <p className="mt-1 text-sm text-muted">Transaction {shortAddress(hash)} is submitted. This usually takes a few seconds.</p>
        </>
      )}
      {receipt.isError && <Failed error={receipt.error} />}
      {receipt.isSuccess && <Confirmed receipt={receipt.data} />}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ExternalButton href={explorer}>View in explorer</ExternalButton>
        <BackLink />
      </div>
    </Card>
  );
}

const TITLES = {
  entered: "Deposit confirmed",
  exited: "Exit confirmed",
  claim: "Fees claimed",
  "sp-deposit": "Stability Pool deposit confirmed",
  "sp-withdraw": "Stability Pool withdrawal confirmed",
  "sp-claim": "BTC gain claimed",
} as const;

function Confirmed({ receipt }: { receipt: TransactionReceipt }) {
  const { network } = useNetwork();
  const result = receiptKind(receipt.logs, network);
  if (!result) {
    return (
      <>
        <h1 className="text-lg font-semibold">Transaction confirmed</h1>
        <p className="mt-2 text-sm text-muted">This transaction has no MezoRoute action.</p>
      </>
    );
  }
  const borrowed = result.kind === "entered" && result.event.musdBorrowed > 0n;
  const rows =
    result.kind === "entered"
      ? enteredRows(result.event)
      : result.kind === "exited"
        ? exitedRows(result.event)
        : result.kind === "claim"
          ? claimRows(result.fees)
          : spReceiptRows(result.sp);
  return (
    <>
      <h1 className="text-lg font-semibold">{borrowed ? "Borrow & deposit confirmed" : TITLES[result.kind]}</h1>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        {rows.map((row) => (
          <StatRow key={row.label} label={row.label}>
            {row.value}
          </StatRow>
        ))}
        <StatRow label="Gas used">{formatToken(receipt.gasUsed, 0, 0)}</StatRow>
        <StatRow label="Block">{receipt.blockNumber.toString()}</StatRow>
      </dl>
      {borrowed && <TroveNow />}
    </>
  );
}

function TroveNow() {
  const { address } = useAccount();
  return address ? <TroveNowFor account={address} /> : null;
}

/** The Trove read after confirmation (Flow D step 7). */
function TroveNowFor({ account }: { account: Address }) {
  const { data } = useDashboardSnapshot(account);
  const trove = data?.snapshot.trove;
  if (!data || !trove) return null;
  const cr = collateralRatio(trove, data.snapshot.price);
  return (
    <>
      <h2 className="mt-4 text-sm font-semibold">Your Trove now</h2>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="Debt">{`${formatToken(trove.debt, 18, 2)} MUSD`}</StatRow>
        <StatRow label="Collateral ratio">{cr === null ? "—" : formatPercent(cr, 1)}</StatRow>
      </dl>
    </>
  );
}

function Failed({ error }: { error: Error }) {
  const { network } = useNetwork();
  const decoded = decodeError(error, network);
  return (
    <>
      <h1 className="text-lg font-semibold">{decoded.kind === "unconfirmed" ? "Not confirmed yet" : "Transaction failed"}</h1>
      <p className="mt-1 text-sm">{decoded.message}</p>
    </>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <section className="rounded-2xl bg-white p-5 shadow-card">{children}</section>;
}

function BackLink() {
  return (
    <span className="flex gap-3">
      <Link href="/positions/" className="text-xs font-semibold text-accent hover:underline">
        View positions
      </Link>
      <Link href="/" className="text-xs font-semibold text-accent hover:underline">
        Back to dashboard
      </Link>
    </span>
  );
}
