"use client";

import { useState, type ReactNode } from "react";
import { AmountInput } from "@/components/lp/AmountInput";
import { musd } from "@/components/lp/units";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { RiskList } from "@/components/ui/RiskList";
import { Skeleton } from "@/components/ui/Skeleton";
import { compareRoutes } from "@/lib/compare/comparison";
import { backtestRoutes, type RouteBacktests } from "@/lib/compare/history";
import { useRouteHistory } from "@/lib/compare/useRouteHistory";
import { amountState, lpHistoryLine, REFERENCE_AMOUNT, signedChange, spHistoryLine, windowDate, windowDays } from "@/lib/compare/view";
import { useNetwork } from "@/lib/config/network-context";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { formatToken } from "@/lib/format";
import { DEFAULT_SLIPPAGE } from "@/lib/quote/entry";
import { LP_RETURN_SOURCE, LP_RISKS, SP_RETURN_SOURCE, SP_RISKS } from "@/lib/routes/copy";
import { entryQuery } from "@/lib/routes/musd-btc-lp/intent";
import { spDepositQuery } from "@/lib/stability-pool/intent";
import { cx } from "@/lib/ui/cx";
import { lpAmountRows, lpFee, spAmountRows, type Row } from "./compare-rows";

const FOOTNOTE =
  "Past results, not a forecast. LP values use the pool's own price (before your trade), not the oracle; Stability Pool BTC gains use the oracle price. LP gauge rewards are not included; the −30% row uses the constant-product approximation and does not model new liquidations.";
const GRID = "grid grid-cols-[minmax(7rem,0.7fr)_1fr_1fr] gap-x-6";

type RouteId = "lp" | "sp";
type Route = { id: RouteId; title: string; tagline: string; rows: Row[]; risks: string[]; href: string; cta: string };

/** Flow B / FR-19: both routes for the typed amount, aligned row by row, with what each paid over the last 30 days. */
export function RouteComparison({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { network } = useNetwork();
  const [text, setText] = useState("");
  const [tab, setTab] = useState<RouteId>("lp");
  const { amount, error: amountError } = amountState(text);
  const executorFeeBps = network.executor?.feeBps ?? null;
  const compared = amount === null ? null : compareRoutes({ snapshot, amount, executorFeeBps });
  const { history, error: historyError, retry } = useRouteHistory();
  const historyFailed = history === undefined && historyError !== null;
  const backtestAmount = amount ?? REFERENCE_AMOUNT;
  const backtests = history ? backtestRoutes(history, backtestAmount, executorFeeBps ?? 0n) : null;
  const typed = amount === null ? "" : text.trim();

  const pending = (value: (b: RouteBacktests) => ReactNode): ReactNode =>
    backtests ? value(backtests) : historyFailed ? "Unavailable" : <Skeleton className="h-4 w-28" />;
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

  const routes: Route[] = [
    {
      id: "lp",
      title: "MUSD/BTC LP",
      tagline: "Earn swap fees",
      rows: [
        { label: "Return source", value: LP_RETURN_SOURCE },
        historyRow((b) => (b.lp ? lpHistoryLine(b.lp) : "Unavailable")),
        backtestRow((b) => b.lp?.valueNow ?? null),
        { label: "MezoRoute fee", value: lpFee(executorFeeBps, compared) },
        ...lpAmountRows(compared),
      ],
      risks: LP_RISKS,
      href: `/route/lp/${entryQuery({ amount: typed, slippageBps: DEFAULT_SLIPPAGE })}`,
      cta: "Choose LP",
    },
    {
      id: "sp",
      title: "Stability Pool",
      tagline: "Back the system",
      rows: [
        { label: "Return source", value: SP_RETURN_SOURCE },
        historyRow((b) => spHistoryLine(b.sp)),
        backtestRow((b) => b.sp.valueNow),
        { label: "MezoRoute fee", value: "None (direct to the pool)" },
        ...spAmountRows(compared),
      ],
      risks: SP_RISKS,
      href: `/route/stability-pool/${spDepositQuery(typed)}`,
      cta: "Choose Stability Pool",
    },
  ];
  const [lp, sp] = routes;

  return (
    <Card id="compare" title="Compare routes" subtitle="Where to put MUSD: both routes for the same amount.">
      <div className="mt-4 max-w-md">
        <AmountInput amount={text} max={snapshot.musd} maxLabel="Wallet balance" onAmount={setText} />
        {amountError && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {amountError}
          </p>
        )}
        {compared?.overBalance && (
          <p className="mt-2 text-sm text-muted">More than your wallet holds; the route page will ask for a smaller amount.</p>
        )}
      </div>
      {historyFailed && (
        <Notice
          className="mt-4"
          action={
            <Button size="sm" variant="secondary" onClick={retry}>
              Retry
            </Button>
          }
        >
          30-day results unavailable.
        </Notice>
      )}
      {compared === null && (
        <p className="mt-4 text-sm text-muted">Enter an amount to see the position, BTC exposure, and a 30% BTC drop for each route.</p>
      )}

      {/* From 640 px: one table, so like values line up. */}
      <div role="table" aria-label="Route comparison" className="mt-4 hidden sm:block">
        <div role="row" className={cx(GRID, "border-b border-line pb-3")}>
          {/* The cell keeps its grid column; only the text is visually hidden. */}
          <span role="columnheader">
            <span className="sr-only">Detail</span>
          </span>
          {routes.map((route) => (
            <div key={route.id} role="columnheader">
              <p className="font-semibold">{route.title}</p>
              <p className="text-sm font-normal text-muted">{route.tagline}</p>
            </div>
          ))}
        </div>
        {lp.rows.map((row, index) => (
          <div key={row.label} role="row" className={cx(GRID, "border-b border-line/60 py-3 text-sm")}>
            <span role="rowheader" title={row.title} className="text-muted">
              {row.label}
            </span>
            <Cell row={row} />
            <Cell row={sp.rows[index]} />
          </div>
        ))}
        <div role="row" className={cx(GRID, "py-3")}>
          <span role="rowheader" className="text-sm text-muted">
            Risks
          </span>
          {routes.map((route) => (
            <div key={route.id} role="cell">
              <RiskList risks={route.risks} />
            </div>
          ))}
        </div>
        <div role="row" className={cx(GRID, "pt-2")}>
          <span aria-hidden />
          {routes.map((route) => (
            <div key={route.id} role="cell">
              <ButtonLink href={route.href}>{route.cta}</ButtonLink>
            </div>
          ))}
        </div>
      </div>

      {/* Below 640 px: one route at a time. */}
      <div className="mt-4 sm:hidden">
        <div role="tablist" aria-label="Routes" className="flex rounded-full bg-well p-1 text-sm font-medium">
          {routes.map((route) => (
            <button
              key={route.id}
              type="button"
              role="tab"
              id={`tab-${route.id}`}
              aria-selected={tab === route.id}
              aria-controls={`panel-${route.id}`}
              onClick={() => setTab(route.id)}
              className={cx("min-h-10 flex-1 rounded-full px-3 transition-colors duration-150", tab === route.id ? "bg-line text-ink" : "text-muted")}
            >
              {route.title}
            </button>
          ))}
        </div>
        {routes.map((route) => (
          <div key={route.id} role="tabpanel" id={`panel-${route.id}`} aria-labelledby={`tab-${route.id}`} hidden={tab !== route.id} className="mt-4">
            <p className="text-sm text-muted">{route.tagline}</p>
            <dl className="mt-3 space-y-3 text-sm">
              {route.rows.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs text-muted" title={row.title}>
                    {row.label}
                  </dt>
                  <dd className="[overflow-wrap:anywhere]">
                    {row.value}
                    {row.sub && <span className="block text-xs text-muted">{row.sub}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <RiskList risks={route.risks} />
            </div>
            <ButtonLink href={route.href} className="mt-4 w-full">
              {route.cta}
            </ButtonLink>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">{FOOTNOTE}</p>
    </Card>
  );
}

function Cell({ row }: { row: Row }) {
  return (
    <div role="cell" className="min-w-0 [overflow-wrap:anywhere]">
      {row.value}
      {row.sub && <span className="block text-xs text-muted">{row.sub}</span>}
    </div>
  );
}
