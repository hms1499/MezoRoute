import type { OverviewRow } from "@/components/flow/Overview";
import { Button } from "@/components/ui/Button";
import { Term } from "@/components/ui/Term";
import { formatBps, formatPercent } from "@/lib/format";
import { GAUGE_READ_FAILED_ENTRY } from "@/lib/gauge/copy";
import { entryValue } from "@/lib/quote/entry";
import { QUOTE_TTL_MS } from "@/lib/routes/musd-btc-lp/gate";
import type { EntryPreview } from "@/lib/routes/musd-btc-lp/preview";
import type { LpRouteData } from "@/lib/routes/musd-btc-lp/snapshot";
import { QUOTE_REFRESH_MS } from "@/lib/routes/musd-btc-lp/useLpRouteSnapshot";
import { cx } from "@/lib/ui/cx";
import { quoteTimer } from "@/lib/ui/countdown";
import { btc, btcFine, lp, musd } from "./units";

/** Exact amounts, minimums, and deadline (spec §9 screen 3a), as the Confirm card's overview rows (U11 §6.2). */
export function confirmOverview({ preview, data, slippageBps }: { preview: EntryPreview; data: LpRouteData; slippageBps: bigint }): OverviewRow[] {
  const { quote, minimums, btcQuote, btcMinimums } = preview;
  const fee = { label: "MezoRoute fee", sub: formatBps(data.snapshot.executorFeeBps) };
  // The rows every entry ends with, whichever token it brings.
  const tail: OverviewRow[] = [
    ...(preview.stake.availability !== "unavailable"
      ? [
          {
            label: "Staking",
            value: preview.stake.on ? "Staked in the MEZO gauge" : "Not staked",
            sub: preview.stake.on ? "swap fees go to veBTC voters while staked" : undefined,
          },
        ]
      : []),
    ...(data.snapshot.dashboard.gaugeReadFailed ? [{ label: "Staking", value: "Not staked", sub: GAUGE_READ_FAILED_ENTRY }] : []),
    { label: "Slippage", value: formatBps(slippageBps, 1) },
    { label: "Deadline", value: new Date(Number(preview.deadline) * 1000).toLocaleTimeString(), sub: "10 minutes after this quote's block" },
  ];
  if (btcQuote && btcMinimums) {
    return [
      { label: "You deposit", value: btcFine(btcQuote.btcIn) },
      { ...fee, value: btcFine(btcQuote.fee) },
      { label: "Swapped to MUSD", value: btcFine(btcQuote.btcToSwap), sub: `at least ${musd(btcMinimums.minMusdFromSwap)}` },
      {
        label: "Deposited to the pool",
        value: (
          <>
            <span className="block">{musd(btcQuote.musdAdded)}</span>
            <span className="block">+ {btcFine(btcQuote.btcAdded)}</span>
          </>
        ),
        sub: `at least ${musd(btcMinimums.minMusdAdded)} + ${btcFine(btcMinimums.minBtcAdded)}`,
      },
      {
        label: "LP tokens",
        value: lp(btcQuote.liquidity),
        sub: `≈ ${musd(entryValue(data.snapshot.pool, btcQuote))} at the pool price · at least ${lp(btcMinimums.minLpOut)}`,
      },
      ...tail,
    ];
  }
  if (!quote || !minimums) return tail;
  return [
    { label: preview.borrow ? "You borrow and deposit" : "You deposit", value: musd(quote.musdIn) },
    { ...fee, value: musd(quote.fee) },
    ...(preview.borrow?.effect
      ? [
          { label: "Borrowing fee", value: musd(preview.borrow.effect.fee), sub: "added to your Trove debt" },
          {
            label: (
              <>
                <Term id="trove">Trove</Term> debt after
              </>
            ),
            value: musd(preview.borrow.effect.newDebt),
          },
          {
            label: (
              <>
                <Term id="collateralRatio">Collateral ratio</Term> after
              </>
            ),
            value: preview.borrow.effect.newCr === null ? "—" : formatPercent(preview.borrow.effect.newCr, 1),
          },
        ]
      : []),
    { label: "Swapped to BTC", value: musd(quote.musdToSwap), sub: `at least ${btc(minimums.minBtcFromSwap)}` },
    {
      label: "Deposited to the pool",
      value: (
        <>
          <span className="block">{musd(quote.musdAdded)}</span>
          <span className="block">+ {btc(quote.btcAdded)}</span>
        </>
      ),
      sub: `at least ${musd(minimums.minMusdAdded)} + ${btc(minimums.minBtcAdded)}`,
    },
    {
      label: "LP tokens",
      value: lp(quote.liquidity),
      sub: `≈ ${musd(entryValue(data.snapshot.pool, quote))} at the pool price · at least ${lp(minimums.minLpOut)}`,
    },
    ...tail,
  ];
}

/** The quote's block, its countdown to the next refresh, and Refresh once it has expired. */
export function QuoteBlock({ data, now, onRefresh }: { data: LpRouteData; now: number; onRefresh: () => void }) {
  const timer = quoteTimer(now, data.fetchedAt, QUOTE_REFRESH_MS, QUOTE_TTL_MS);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>Quote from block {data.snapshot.blockNumber.toString()}</span>
        {timer.phase === "expired" ? (
          <Button size="md" variant="secondary" onClick={onRefresh}>
            Refresh quote
          </Button>
        ) : (
          <span className={cx(timer.phase === "expiring" && "font-medium text-warning-ink")}>
            {timer.phase === "fresh" && `Refreshes in ${timer.secondsLeft}s`}
            {timer.phase === "refreshing" && "Refreshing…"}
            {timer.phase === "expiring" && `Not refreshed · expires in ${timer.secondsLeft}s`}
          </span>
        )}
      </div>
      <div aria-hidden className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div
          className={cx("h-full origin-left transition-transform duration-tick ease-linear", timer.phase === "expiring" ? "bg-warning-ink" : "bg-accent")}
          style={{ transform: `scaleX(${timer.remaining})` }}
        />
      </div>
    </div>
  );
}
