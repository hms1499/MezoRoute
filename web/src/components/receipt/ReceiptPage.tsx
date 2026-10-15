"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, Clock, LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { Address, Hash, TransactionReceipt } from "viem";
import { useAccount, useConfig } from "wagmi";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
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
import { receiptState, type ReceiptState } from "@/lib/tx/receipt-state";
import { confirmCall, isTxHash } from "@/lib/tx/send";
import { cx } from "@/lib/ui/cx";

const RECEIPT_KEY = "entry-receipt";

/** Spec §9 screen 4: progress until confirmed, then values from the Entered, Exited, pool Claim, or Stability Pool events only (FR-11, FR-13). */
export default function ReceiptPage() {
  const hash = useSearchParams().get("hash");
  if (!isTxHash(hash)) {
    return (
      <Card>
        <p className="text-sm">This link has no valid transaction hash.</p>
        <Actions />
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
  const state = receiptState({ isSuccess: receipt.isSuccess, errorKind: receipt.error ? decodeError(receipt.error, network).kind : null });
  return (
    <>
      <PageHeader back={{ href: "/", label: "Dashboard" }} step={state === "confirmed" ? 3 : 2} labels={["Amount", "Confirm", "Done"]} />
      <Card>
        <StatusIcon state={state} />
        <Timeline state={state} />
        <div className="mt-4">
          {receipt.isPending && (
            <>
              <h1 className="text-xl font-semibold">Confirming…</h1>
              <p className="mt-1 text-sm text-muted">Transaction {shortAddress(hash)} is submitted. This usually takes a few seconds.</p>
            </>
          )}
          {receipt.isError && <Failed error={receipt.error} />}
          {receipt.isSuccess && <Confirmed receipt={receipt.data} />}
        </div>
        <Actions explorer={explorer} />
      </Card>
    </>
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
        <h1 className="text-xl font-semibold">Transaction confirmed</h1>
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
      <h1 className="text-xl font-semibold">{borrowed ? "Borrow & deposit confirmed" : TITLES[result.kind]}</h1>
      <dl className="mt-3 stat-list">
        {rows.map((row) => (
          <Stat key={row.label} label={row.label}>
            {row.value}
          </Stat>
        ))}
        <Stat label="Gas used">{formatToken(receipt.gasUsed, 0, 0)}</Stat>
        <Stat label="Block">{receipt.blockNumber.toString()}</Stat>
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
      <dl className="mt-2 stat-list">
        <Stat label="Debt">{`${formatToken(trove.debt, 18, 2)} MUSD`}</Stat>
        <Stat label="Collateral ratio">{cr === null ? "—" : formatPercent(cr, 1)}</Stat>
      </dl>
    </>
  );
}

function Failed({ error }: { error: Error }) {
  const { network } = useNetwork();
  const decoded = decodeError(error, network);
  return (
    <>
      <h1 className="text-xl font-semibold">{decoded.kind === "unconfirmed" ? "Not confirmed yet" : "Transaction failed"}</h1>
      <p className="mt-1 text-sm">{decoded.message}</p>
    </>
  );
}

function StatusIcon({ state }: { state: ReceiptState }) {
  const shared = "h-12 w-12";
  if (state === "unconfirmed") return <Clock aria-hidden className={cx(shared, "text-warning-ink")} />;
  if (state === "confirmed") return <CircleCheck aria-hidden className={cx(shared, "text-accent")} />;
  if (state === "failed") return <CircleX aria-hidden className={cx(shared, "text-danger")} />;
  return <LoaderCircle aria-hidden className={cx(shared, "text-accent motion-safe:animate-spin")} />;
}

const LAST_STAGE: Record<ReceiptState, string> = {
  pending: "Confirmed",
  confirmed: "Confirmed",
  failed: "Failed",
  unconfirmed: "Not confirmed yet",
};

/** Submitted → Confirming → Confirmed (U1 §6); an unconfirmed transaction ends in amber, never "Failed". */
function Timeline({ state }: { state: ReceiptState }) {
  const stages = [
    { label: "Submitted", done: true },
    { label: "Confirming", done: state !== "pending", current: state === "pending" },
    { label: LAST_STAGE[state], done: state === "confirmed", failed: state === "failed", unknown: state === "unconfirmed" },
  ];
  return (
    <ol aria-label="Transaction status" className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
      {stages.map((stage, index) => (
        <li key={stage.label} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden className={cx("h-px w-6", stage.done || stage.current ? "bg-accent" : "bg-line")} />}
          <span
            className={cx(
              stage.failed ? "text-danger" : stage.unknown ? "text-warning-ink" : stage.done ? "text-accent" : stage.current ? "text-ink" : "text-muted",
            )}
          >
            {stage.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Actions({ explorer }: { explorer?: string }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <ButtonLink href="/positions/">View positions</ButtonLink>
      {explorer && (
        <ButtonLink href={explorer} external variant="secondary">
          View on explorer
        </ButtonLink>
      )}
    </div>
  );
}
