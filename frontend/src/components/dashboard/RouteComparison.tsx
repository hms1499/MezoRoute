"use client";

import { useState, type ReactNode } from "react";
import { TokenAmountInput } from "@/components/flow/TokenAmountInput";
import { musd } from "@/components/lp/units";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { RiskList } from "@/components/ui/RiskList";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { Term } from "@/components/ui/Term";
import { compareRoutes } from "@/lib/compare/comparison";
import { compareStart, showsOverBalance } from "@/lib/compare/default-amount";
import { backtestRoutes, type RouteBacktests } from "@/lib/compare/history";
import { useRouteHistory } from "@/lib/compare/useRouteHistory";
import { amountState, lpHistoryLine, REFERENCE_AMOUNT, savingsHistoryLine, signedChange, spHistoryLine, windowDate, windowDays } from "@/lib/compare/view";
import { useNetwork } from "@/lib/config/network-context";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { formatToken } from "@/lib/format";
import { useMezoPrice } from "@/lib/gauge/useMezoPrice";
import type { TermId } from "@/lib/glossary";
import { DEFAULT_SLIPPAGE } from "@/lib/quote/entry";
import { LP_RETURN_SOURCE, LP_RISKS, SAVINGS_RETURN_SOURCE, SAVINGS_RISKS, SP_RETURN_SOURCE, SP_RISKS } from "@/lib/routes/copy";
import { savingsReturn, savingsWeek } from "@/lib/savings/maths";
import { useSavingsHistory, useSavingsVault } from "@/lib/savings/useSavingsVault";
import { WAD } from "@/lib/math";
import { entryQuery } from "@/lib/routes/musd-btc-lp/intent";
import { spDepositQuery } from "@/lib/stability-pool/intent";
import { cx } from "@/lib/ui/cx";
import { lpAmountRows, lpFee, lpGaugeRows, routeTabLabel, savingsAmountRows, savingsGaugeRows, spAmountRows, spSourceNote, subToneClass, type Row } from "./compare-rows";
import { signedTone } from "@/lib/ui/signed";
import { Settle } from "@/components/ui/Settle";
import { Disclosure } from "@/components/ui/Disclosure";

const FOOTNOTE =
  "LP values use the pool's own price (before your trade), not the oracle; Stability Pool BTC gains use the oracle price. The 30-day LP rows are swap fees only: MEZO rewards are not backtested, and the MEZO figure is this week's rate. The −30% row uses the constant-product approximation and does not model new liquidations.";
const SAVINGS_NOTE = " The sMUSD rows read the vault's own yield index and its gauge; MezoRoute takes no fee there.";
const GRID = "grid grid-cols-[minmax(7rem,0.7fr)_1fr_1fr] gap-x-6";
// U19: a third column for the Savings Vault when it could be read.
const GRID3 = "grid grid-cols-[minmax(7rem,0.7fr)_1fr_1fr_1fr] gap-x-6";

type RouteId = "lp" | "sp" | "savings";
type Route = { id: RouteId; title: string; term?: TermId; tagline: string; rows: Row[]; risks: string[]; href: string; cta: string; external?: boolean };

/** Flow B / FR-19: both routes for the typed amount, aligned row by row, with what each paid over the last 30 days. */
/** `heading={false}` (U15): on /compare/ the page's h1 and subtitle name the comparison, so the card has no title. */
/**
 * U17 §6: `start` is the raw `?amount=` of /compare/ (a valid one is the starting amount); `connected={false}` is the
 * page before a wallet connects, when the snapshot was read for the zero address: no balance, no Max, and no note
 * about what the wallet holds.
 */
export function RouteComparison({
  snapshot,
  heading = true,
  start = null,
  connected = true,
  value = null,
  onChange,
}: {
  snapshot: DashboardSnapshot;
  heading?: boolean;
  start?: string | null;
  connected?: boolean;
  /** U17 review: the field's value, held by the page so it survives this card's remount; null = never typed. */
  value?: string | null;
  onChange?: (text: string) => void;
}) {
  const { network } = useNetwork();
  // Starts filled, so both routes show on arrival (U3 §5.2); an empty wallet gets a 1,000 MUSD example.
  const [initial] = useState(() => compareStart(start, snapshot.musd, network.entryCap));
  // U17 review: this card remounts whenever its snapshot changes (a wallet connects on /compare/), so the page holds
  // what was typed. Null means nobody has typed here: the card then starts from the balance, or from the example.
  const [own, setOwn] = useState(initial.text);
  const text = value ?? own;
  const setText = (next: string) => {
    setOwn(next);
    onChange?.(next);
  };
  const showsExample = initial.example && text === initial.text;
  const [tab, setTab] = useState<RouteId>("lp");
  const { amount, error: amountError } = amountState(text);
  const executorFeeBps = network.executor?.feeBps ?? null;
  const mezoPrice = useMezoPrice(network, snapshot.block?.number);
  const compared = amount === null ? null : compareRoutes({ snapshot, amount, executorFeeBps, mezoPrice });
  const { history, error: historyError, retry } = useRouteHistory();
  const historyFailed = history === undefined && historyError !== null;
  const backtestAmount = amount ?? REFERENCE_AMOUNT;
  const backtests = history ? backtestRoutes(history, backtestAmount, executorFeeBps ?? 0n) : null;
  const typed = amount === null ? "" : text.trim();
  // U19: the Savings Vault at the snapshot's block, and its index at the history's two blocks.
  const savings = useSavingsVault(network, snapshot.block?.number);
  const savingsIndexes = useSavingsHistory(network, history);
  const savingsWeekRate =
    savings && amount !== null && snapshot.block ? savingsWeek({ state: savings, amount, now: snapshot.block.timestamp, mezoPrice }) : null;

  const pending = (value: (b: RouteBacktests) => ReactNode): ReactNode =>
    backtests ? <Settle as="span">{value(backtests)}</Settle> : historyFailed ? "Unavailable" : <Skeleton className="h-4 w-28" />;
  const historyRow = (line: (b: RouteBacktests) => string, sub?: string): Row => ({
    label: backtests ? `Last ${windowDays(backtests.seconds)} days` : "Last 30 days",
    title: backtests ? `Blocks ${backtests.pastBlock} → ${backtests.headBlock}` : undefined,
    value: pending(line),
    sub,
  });
  const backtestRow = (valueNow: (b: RouteBacktests) => bigint | null): Row => {
    const value = backtests ? valueNow(backtests) : null;
    return {
      label: `${formatToken(backtestAmount, 18, 2)} MUSD ${backtests ? `on ${windowDate(backtests.pastTime)}` : "30 days ago"}`,
      value: pending(() => (value === null ? "Unavailable" : `${musd(value)} today`)),
      sub: value === null ? undefined : signedChange(value, backtestAmount),
      subTone: value === null ? null : signedTone(value - backtestAmount),
    };
  };

  const routes: Route[] = [
    {
      id: "lp",
      title: "MUSD/BTC LP",
      tagline: "Collect swap fees or MEZO",
      rows: [
        { label: "Return source", value: LP_RETURN_SOURCE },
        ...lpGaugeRows(compared),
        historyRow((b) => (b.lp ? lpHistoryLine(b.lp) : "Unavailable"), "Swap fees only; MEZO is not backtested"),
        backtestRow((b) => b.lp?.valueNow ?? null),
        { label: "MezoRoute fee", value: lpFee(executorFeeBps, compared) },
        ...lpAmountRows(compared, connected),
      ],
      risks: LP_RISKS,
      href: `/route/lp/${entryQuery({ amount: typed, slippageBps: DEFAULT_SLIPPAGE })}`,
      cta: "Choose LP",
    },
    {
      id: "sp",
      title: "Stability Pool",
      term: "stabilityPool",
      tagline: "Back the system",
      rows: [
        { label: "Return source", value: SP_RETURN_SOURCE, sub: spSourceNote(snapshot.troveDebt) },
        historyRow((b) => spHistoryLine(b.sp)),
        backtestRow((b) => b.sp.valueNow),
        { label: "MezoRoute fee", value: "None (direct to the pool)" },
        ...spAmountRows(compared, connected),
      ],
      risks: SP_RISKS,
      href: `/route/stability-pool/${spDepositQuery(typed)}`,
      cta: "Choose Stability Pool",
    },
  ];
  if (savings) {
    const ret = savingsIndexes ? savingsReturn(savingsIndexes.past, savingsIndexes.now) : null;
    const savingsPending = (value: (b: RouteBacktests, r: bigint) => ReactNode): ReactNode =>
      backtests && ret !== null ? (
        <Settle as="span">{value(backtests, ret)}</Settle>
      ) : historyFailed || savingsIndexes === null ? (
        "Unavailable"
      ) : (
        <Skeleton className="h-4 w-28" />
      );
    const savingsNow = ret === null ? null : backtestAmount + (backtestAmount * ret) / WAD;
    routes.push({
      id: "savings",
      title: "Savings Vault (sMUSD)",
      tagline: "Mezo's MUSD savings rate",
      rows: [
        { label: "Return source", value: SAVINGS_RETURN_SOURCE },
        ...savingsGaugeRows(savingsWeekRate),
        {
          label: backtests ? `Last ${windowDays(backtests.seconds)} days` : "Last 30 days",
          value: savingsPending((b, r) => savingsHistoryLine(r, b.seconds)),
          sub: "Unstaked; MEZO is not backtested",
        },
        {
          label: `${formatToken(backtestAmount, 18, 2)} MUSD ${backtests ? `on ${windowDate(backtests.pastTime)}` : "30 days ago"}`,
          value: savingsPending(() => `${musd(savingsNow ?? 0n)} today`),
          sub: savingsNow === null || !backtests ? undefined : signedChange(savingsNow, backtestAmount),
          subTone: savingsNow === null || !backtests ? null : signedTone(savingsNow - backtestAmount),
        },
        { label: "MezoRoute fee", value: "None · MezoRoute doesn't route here" },
        ...savingsAmountRows(amount),
      ],
      risks: SAVINGS_RISKS,
      href: network.mezoAppUrl,
      cta: "Open in the Mezo app",
      external: true,
    });
  }
  const [lp] = routes;
  // Every row label in column order: the LP's first, then any only another route has (e.g. MEZO when the LP has no gauge).
  const labels = [...new Set(routes.flatMap((route) => route.rows.map((row) => row.label)))];
  const grid = routes.length === 3 ? GRID3 : GRID;

  return (
    <Card id="compare" title={heading ? "Compare routes" : undefined} subtitle={heading ? "Where to put MUSD: both routes for the same amount." : undefined}>
      <div className={cx(heading && "mt-4", "max-w-md")}>
        <TokenAmountInput id="compare-amount" label="Amount" amount={text} onAmount={setText} token="musd" balance={connected ? snapshot.musd : null} balanceLabel="Wallet balance" max={connected ? snapshot.musd : null} />
        {amountError && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {amountError}
          </p>
        )}
        {showsExample && <p className="mt-1 text-sm text-muted">Example amount.</p>}
        {savings === null && network.savingsVault && <p className="mt-1 text-sm text-muted">The Savings Vault could not be read right now.</p>}
        {showsOverBalance({ connected, overBalance: compared?.overBalance ?? false, example: showsExample }) && (
          <p className="mt-2 text-sm text-muted">More than your wallet holds; the route page will ask for a smaller amount.</p>
        )}
      </div>
      {historyFailed && (
        <Notice
          className="mt-4"
          action={
            <Button size="md" variant="secondary" onClick={retry}>
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
        <div role="row" className={cx(grid, "border-b border-line pb-3")}>
          {/* The cell keeps its grid column; only the text is visually hidden. */}
          <span role="columnheader">
            <span className="sr-only">Detail</span>
          </span>
          {routes.map((route) => (
            <div key={route.id} role="columnheader">
              <p className="font-semibold">{route.term ? <Term id={route.term}>{route.title}</Term> : route.title}</p>
              <p className="text-sm font-normal text-muted">{route.tagline}</p>
            </div>
          ))}
        </div>
        {labels.map((label) => (
          <div key={label} role="row" className={cx(grid, "border-b border-line/60 py-3 text-sm")}>
            <span role="rowheader" title={lp.rows.find((row) => row.label === label)?.title} className="text-muted">
              {label}
            </span>
            {routes.map((route) => (
              <Cell key={route.id} row={route.rows.find((candidate) => candidate.label === label)} />
            ))}
          </div>
        ))}
        <div role="row" className={cx(grid, "py-3")}>
          <span role="rowheader" className="text-sm text-muted">
            Risks
          </span>
          {routes.map((route) => (
            <div key={route.id} role="cell">
              <RiskList risks={route.risks} />
            </div>
          ))}
        </div>
        <div role="row" className={cx(grid, "pt-2")}>
          <span aria-hidden />
          {routes.map((route) => (
            <div key={route.id} role="cell">
              <ButtonLink href={route.href} variant="secondary" external={route.external}>
                {route.cta}
              </ButtonLink>
            </div>
          ))}
        </div>
      </div>

      {/* Below 640 px: one route at a time. */}
      <div className="mt-4 sm:hidden">
        <Segmented
          label="Routes"
          semantics="tabs"
          size="sm"
          fill
          options={routes.map((route) => ({ value: route.id, label: routeTabLabel(route.id, routes.length), id: `tab-${route.id}`, controls: `panel-${route.id}` }))}
          value={tab}
          onChange={setTab}
        />
        {routes.map((route) => (
          <div key={route.id} role="tabpanel" id={`panel-${route.id}`} aria-labelledby={`tab-${route.id}`} hidden={tab !== route.id} className="mt-4">
            <p className="text-sm text-muted">
              {/* The tab is a button, so the term's definition sits on the panel's first line (U8). */}
              {route.term && (
                <>
                  <Term id={route.term}>{route.title}</Term>:{" "}
                </>
              )}
              {route.tagline}
            </p>
            <dl className="mt-3 space-y-3 text-sm">
              {route.rows.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs text-muted" title={row.title}>
                    {row.label}
                  </dt>
                  <dd className="[overflow-wrap:anywhere]">
                    {row.value}
                    {row.sub && <span className={cx("block text-sm", subToneClass(row.subTone))}>{row.sub}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <RiskList risks={route.risks} />
            </div>
            <ButtonLink href={route.href} variant="secondary" external={route.external} className="mt-4 w-full">
              {route.cta}
            </ButtonLink>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">Past results, not a forecast.</p>
      <Disclosure summary="How these figures are made">
        {FOOTNOTE}
        {savings ? SAVINGS_NOTE : ""}
      </Disclosure>
    </Card>
  );
}

/** A route without the row (the Stability Pool has no gauge) shows a muted note, so the table still lines up. */
function Cell({ row }: { row: Row | undefined }) {
  if (!row) {
    return (
      <div role="cell" className="text-muted">
        Not applicable
      </div>
    );
  }
  return (
    <div role="cell" className="min-w-0 [overflow-wrap:anywhere]">
      {row.value}
      {row.sub && <span className={cx("block text-sm", subToneClass(row.subTone))}>{row.sub}</span>}
    </div>
  );
}
