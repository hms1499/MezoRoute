"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AmountInput } from "@/components/lp/AmountInput";
import { btc, musd } from "@/components/lp/units";
import { compareRoutes, STRESS_DROP, type ComparedRoutes } from "@/lib/compare/comparison";
import { backtestRoutes, type RouteBacktests } from "@/lib/compare/history";
import { useRouteHistory } from "@/lib/compare/useRouteHistory";
import { amountState, lpHistoryLine, REFERENCE_AMOUNT, signedChange, spHistoryLine, windowDate, windowDays } from "@/lib/compare/view";
import { useNetwork } from "@/lib/config/network-context";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { DEFAULT_SLIPPAGE } from "@/lib/quote/entry";
import { LP_RETURN_SOURCE, LP_RISKS, SP_RETURN_SOURCE, SP_RISKS } from "@/lib/routes/copy";
import { entryQuery } from "@/lib/routes/musd-btc-lp/intent";
import { spDepositQuery } from "@/lib/stability-pool/intent";

const FOOTNOTE =
  "Past results, not a forecast. LP values use the pool's own price (before your trade), not the oracle; Stability Pool BTC gains use the oracle price. LP gauge rewards are not included; the −30% row uses the constant-product approximation and does not model new liquidations.";
const ENTER_AMOUNT = "Enter an amount";

type Row = { label: string; title?: string; value: ReactNode; sub?: string };

/** Flow B / FR-19: both routes for the typed amount, with what each paid over the last 30 days. */
export function RouteComparison({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { network } = useNetwork();
  const [text, setText] = useState("");
  const { amount, error: amountError } = amountState(text);
  const executorFeeBps = network.executor?.feeBps ?? null;
  const compared = amount === null ? null : compareRoutes({ snapshot, amount, executorFeeBps });
  const { history, error: historyError, retry } = useRouteHistory();
  const historyFailed = history === undefined && historyError !== null;
  const backtestAmount = amount ?? REFERENCE_AMOUNT;
  const backtests = history ? backtestRoutes(history, backtestAmount, executorFeeBps ?? 0n) : null;
  const typed = amount === null ? "" : text.trim();

  const pending = (value: (b: RouteBacktests) => ReactNode): ReactNode =>
    backtests ? value(backtests) : historyFailed ? "Unavailable" : <Skeleton />;
  const historyRow = (line: (b: RouteBacktests) => string): Row => ({
    label: backtests ? `Last ${windowDays(backtests.seconds)} days` : "Last 30 days",
    title: backtests ? `Blocks ${backtests.pastBlock} → ${backtests.headBlock}` : undefined,
    value: pending(line),
  });
  const backtestRow = (valueNow: (b: RouteBacktests) => bigint | null): Row => {
    const value = backtests ? valueNow(backtests) : null;
    return {
      label: `${formatToken(backtestAmount, 18, 2)} MUSD ${backtests ? `on ${windowDate(backtests.pastTime)}` : "30 days ago"}`,
      value: pending(() => (value === null ? "Unavailable" : `${musd(value)} today`)),
      sub: value === null ? undefined : signedChange(value, backtestAmount),
    };
  };

  const lpRows: Row[] = [
    { label: "Return source", value: LP_RETURN_SOURCE },
    historyRow((b) => (b.lp ? lpHistoryLine(b.lp) : "Unavailable")),
    backtestRow((b) => b.lp?.valueNow ?? null),
    { label: "MezoRoute fee", value: lpFee(executorFeeBps, compared) },
    ...lpAmountRows(compared),
  ];
  const spRows: Row[] = [
    { label: "Return source", value: SP_RETURN_SOURCE },
    historyRow((b) => spHistoryLine(b.sp)),
    backtestRow((b) => b.sp.valueNow),
    { label: "MezoRoute fee", value: "None (direct to the pool)" },
    ...spAmountRows(compared),
  ];

  return (
    <section id="compare" className="scroll-mt-4 rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Compare routes</h2>
      <p className="mt-1 text-xs text-muted">Where to put MUSD: both routes for the same amount.</p>
      <div className="mt-3">
        <AmountInput amount={text} max={snapshot.musd} maxLabel="Wallet balance" onAmount={setText} />
        {amountError && <p className="mt-2 text-xs text-danger">{amountError}</p>}
        {compared?.overBalance && (
          <p className="mt-2 text-xs text-muted">More than your wallet holds; the route page will ask for a smaller amount.</p>
        )}
      </div>
      {historyFailed && (
        <p className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          30-day results unavailable.
          <button type="button" onClick={retry} className="font-semibold underline">
            Retry
          </button>
        </p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <RouteColumn
          title="MUSD/BTC LP"
          tagline="Earn swap fees"
          rows={lpRows}
          risks={LP_RISKS}
          href={`/route/lp/${entryQuery({ amount: typed, slippageBps: DEFAULT_SLIPPAGE })}`}
          cta="Choose LP"
        />
        <RouteColumn
          title="Stability Pool"
          tagline="Back the system"
          rows={spRows}
          risks={SP_RISKS}
          href={`/route/stability-pool/${spDepositQuery(typed)}`}
          cta="Choose Stability Pool"
        />
      </div>
      <p className="mt-3 text-[11px] leading-snug text-muted">{FOOTNOTE}</p>
    </section>
  );
}

function lpFee(executorFeeBps: bigint | null, compared: ComparedRoutes | null): string {
  if (executorFeeBps === null) return "Set at launch";
  if (compared?.lp.status === "ok") return `${formatBps(executorFeeBps)} (${musd(compared.lp.fee)})`;
  return formatBps(executorFeeBps);
}

function lpAmountRows(compared: ComparedRoutes | null): Row[] {
  const dropLabel = `If BTC drops ${STRESS_DROP}%`;
  if (compared === null) {
    return [
      { label: "Position after", value: ENTER_AMOUNT },
      { label: "BTC exposure", value: ENTER_AMOUNT },
      { label: dropLabel, value: ENTER_AMOUNT },
    ];
  }
  const { lp } = compared;
  if (lp.status === "unavailable") {
    return [
      { label: "Position after", value: "Pool quote unavailable" },
      { label: "BTC exposure", value: "Pool quote unavailable" },
      { label: dropLabel, value: "Pool quote unavailable" },
    ];
  }
  return [
    {
      label: "Position after",
      value: `≈ ${musd(lp.positionValue)}`,
      sub: `≈ half becomes BTC · price impact ${formatPercent(lp.priceImpact, 2)}`,
    },
    { label: "BTC exposure", value: `${btc(lp.btcBefore)} → ${btc(lp.btcAfter)}` },
    { label: dropLabel, value: `≈ ${musd(lp.valueAfterDrop)}` },
  ];
}

function spAmountRows(compared: ComparedRoutes | null): Row[] {
  const dropLabel = `If BTC drops ${STRESS_DROP}%`;
  if (compared === null) {
    return [
      { label: "Position after", value: ENTER_AMOUNT },
      { label: "BTC exposure", value: ENTER_AMOUNT },
      { label: dropLabel, value: ENTER_AMOUNT },
    ];
  }
  const { sp } = compared;
  return [
    { label: "Position after", value: musd(sp.positionValue), sub: "Stays in MUSD until liquidations" },
    { label: "BTC exposure", value: `${btc(sp.btcBefore)} → ${btc(sp.btcAfter)}` },
    { label: dropLabel, value: musd(sp.valueAfterDrop), sub: "New liquidations not modelled" },
  ];
}

function RouteColumn({
  title,
  tagline,
  rows,
  risks,
  href,
  cta,
}: {
  title: string;
  tagline: string;
  rows: Row[];
  risks: string[];
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-line p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-xs text-muted">{tagline}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-muted" title={row.title}>
              {row.label}
            </dt>
            <dd>
              {row.value}
              {row.sub && <span className="block text-xs text-muted">{row.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs font-medium">Risks</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted">
        {risks.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
      <Link
        href={href}
        className="mt-4 inline-block self-start rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90"
      >
        {cta}
      </Link>
    </div>
  );
}

function Skeleton() {
  return <span aria-label="Loading" className="inline-block h-4 w-28 animate-pulse rounded bg-line" />;
}
