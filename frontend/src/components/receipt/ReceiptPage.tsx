"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, Clock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { Address, Hash, TransactionReceipt } from "viem";
import { useAccount, useConfig } from "wagmi";
import { FactList } from "@/components/flow/BeforeYouSign";
import { FlowColumn } from "@/components/flow/FlowColumn";
import { Overview } from "@/components/flow/Overview";
import { Card } from "@/components/ui/Card";
import { DotWave } from "@/components/ui/DotWave";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReceiptCard } from "./ReceiptCard";
import { useNetwork } from "@/lib/config/network-context";
import { decodeError } from "@/lib/errors/decode";
import { useDashboardSnapshot } from "@/lib/dashboard/useDashboardSnapshot";
import { formatPercent, formatToken, shortAddress } from "@/lib/format";
import { gaugeReceiptRows } from "@/lib/gauge/actions";
import { claimRows } from "@/lib/positions/claim";
import { enteredFromBtcRows, enteredRows, exitedRows } from "@/lib/routes/musd-btc-lp/receipt";
import { TROVE_RECEIPT_TITLES, troveReceiptRows } from "@/lib/leverage/receipt";
import { spReceiptRows } from "@/lib/stability-pool/receipt";
import { collateralRatio } from "@/lib/trove/health";
import { txRows } from "@/lib/receipt/tx-rows";
import { receiptKind } from "@/lib/tx/receipt-kind";
import { receiptState, type ReceiptState } from "@/lib/tx/receipt-state";
import { confirmCall, isTxHash } from "@/lib/tx/send";
import { cx } from "@/lib/ui/cx";
import { receiptHeader } from "@/lib/ui/step-visual";

const RECEIPT_KEY = "entry-receipt";

/** Spec §9 screen 4: progress until confirmed, then values from the Entered, Exited, pool Claim, or Stability Pool events only (FR-11, FR-13). */
export default function ReceiptPage() {
  const hash = useSearchParams().get("hash");
  if (!isTxHash(hash)) {
    return (
      <FlowColumn header={<PageHeader back={{ href: "/", label: "Dashboard" }} />}>
        <ReceiptCard icon={null} title="No transaction" message="This link has no valid transaction hash." />
      </FlowColumn>
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

  const state = receiptState({ isSuccess: receipt.isSuccess, errorKind: receipt.error ? decodeError(receipt.error, network).kind : null });
  const icon = <StatusIcon state={state} />;
  return (
    // U11 §6.2, U14 §A: the card says what happened; the aside says which transaction, and the Trove after it.
    <FlowColumn
      header={<PageHeader back={{ href: "/", label: "Dashboard" }} {...receiptHeader(state)} labels={["Amount", "Confirm", "Done"]} />}
      aside={
        <>
          <Card title="Transaction">
            <FactList facts={txRows(receipt.data ?? { transactionHash: hash }, network)} />
          </Card>
          {receipt.isSuccess && showsTroveNow(receipt.data, network) && <TroveNow />}
        </>
      }
    >
      {receipt.isPending && (
        <ReceiptCard icon={icon} title="Confirming…" message={`Transaction ${shortAddress(hash)} is submitted. This usually takes a few seconds.`} />
      )}
      {receipt.isError && <Failed error={receipt.error} icon={icon} />}
      {receipt.isSuccess && <Confirmed receipt={receipt.data} icon={icon} />}
    </FlowColumn>
  );
}

const GAUGE_TITLES = { claim: "MEZO claimed", stake: "LP staked", unstake: "LP unstaked" } as const;

const TITLES = {
  entered: "Deposit confirmed",
  enteredBtc: "Deposit confirmed",
  exited: "Exit confirmed",
  claim: "Fees claimed",
  "sp-deposit": "Stability Pool deposit confirmed",
  "sp-withdraw": "Stability Pool withdrawal confirmed",
  "sp-claim": "BTC gain claimed",
} as const;

/** A borrow, or a Trove action that leaves the Trove open, shows the Trove as it is now (Flow D step 7). */
function showsTroveNow(receipt: TransactionReceipt, network: Parameters<typeof receiptKind>[1]): boolean {
  const result = receiptKind(receipt.logs, network);
  return result !== null && ((result.kind === "entered" && result.event.musdBorrowed > 0n) || (result.kind === "trove" && result.event.kind !== "closed"));
}

function Confirmed({ receipt, icon }: { receipt: TransactionReceipt; icon: ReactNode }) {
  const { network } = useNetwork();
  const result = receiptKind(receipt.logs, network);
  if (!result) {
    return <ReceiptCard icon={icon} title="Transaction confirmed" message="This transaction has no MezoRoute action." />;
  }
  const borrowed = result.kind === "entered" && result.event.musdBorrowed > 0n;
  const rows =
    result.kind === "entered"
      ? enteredRows(result.event, result.staked)
      : result.kind === "enteredBtc"
        ? enteredFromBtcRows(result.event, result.staked)
        : result.kind === "exited"
        ? exitedRows(result.event)
        : result.kind === "claim"
          ? claimRows(result.fees)
          : result.kind === "gauge"
            ? gaugeReceiptRows(result.gauge)
            : result.kind === "trove"
              ? troveReceiptRows(result.event)
              : spReceiptRows(result.sp);
  return (
    <ReceiptCard
      icon={icon}
      title={
        borrowed
          ? "Borrow & deposit confirmed"
          : result.kind === "gauge"
            ? GAUGE_TITLES[result.gauge.action]
            : result.kind === "trove"
              ? TROVE_RECEIPT_TITLES[result.event.kind]
              : TITLES[result.kind]
      }
      rows={rows.map((row) => ({ label: row.label, value: row.value }))}
    />
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
    <Card title="Your Trove now">
      <Overview
        className="mt-3"
        rows={[
          { label: "Debt", value: `${formatToken(trove.debt, 18, 2)} MUSD` },
          { label: "Collateral ratio", value: cr === null ? "—" : formatPercent(cr, 1) },
        ]}
      />
    </Card>
  );
}

function Failed({ error, icon }: { error: Error; icon: ReactNode }) {
  const { network } = useNetwork();
  const decoded = decodeError(error, network);
  return <ReceiptCard icon={icon} title={decoded.kind === "unconfirmed" ? "Not confirmed yet" : "Transaction failed"} message={decoded.message} />;
}

function StatusIcon({ state }: { state: ReceiptState }) {
  const shared = "h-12 w-12";
  if (state === "unconfirmed") return <Clock aria-hidden className={cx(shared, "text-warning-ink")} />;
  if (state === "confirmed") return <CircleCheck aria-hidden className={cx(shared, "text-accent")} />;
  if (state === "failed") return <CircleX aria-hidden className={cx(shared, "text-danger")} />;
  // U10: the pending button's dot wave continues across the navigation, then turns into the check above.
  return (
    <span aria-hidden className={cx(shared, "flex items-center justify-center rounded-full border-2 border-accent text-accent")}>
      <DotWave size="lg" />
    </span>
  );
}
