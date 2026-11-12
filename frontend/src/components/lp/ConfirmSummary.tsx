import type { OverviewRow } from "@/components/flow/Overview";
import { Button } from "@/components/ui/Button";
import { Term } from "@/components/ui/Term";
import { formatBps, formatPercent } from "@/lib/format";
import { GAUGE_READ_FAILED_ENTRY } from "@/lib/gauge/copy";
import { entryGapRow, entryWorth, type EntryWorth } from "@/lib/flow/entry-worth";
import { WAD } from "@/lib/math";
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
  // The rows every entry ends with, whichever token it brings: what the transaction is signed under.
  const tail: OverviewRow[] = [
    ...(preview.stake.availability !== "unavailable"
      ? [
          {
            group: "Terms",
            label: "Staking",
            value: preview.stake.on ? "Staked in the MEZO gauge" : "Not staked",
            sub: preview.stake.on ? "swap fees go to veBTC voters while staked" : undefined,
          },
        ]
      : []),
    ...(data.snapshot.dashboard.gaugeReadFailed
      ? [{ group: "Terms", label: "Staking", value: "Not staked", sub: GAUGE_READ_FAILED_ENTRY }]
      : []),
    { group: "Terms", label: "Slippage", value: formatBps(slippageBps, 1) },
    {
      group: "Terms",
      label: "Deadline",
      value: new Date(Number(preview.deadline) * 1000).toLocaleTimeString(),
      sub: "10 minutes after this quote's block",
    },
  ];
  // U17: the LP is valued at the oracle price, as on the planner, and a gap of 1% or more to what was put in is said.
  const { price } = data.snapshot.dashboard;
  const received = (worth: EntryWorth, liquidity: bigint, minLpOut: bigint): OverviewRow[] => {
    const gap = entryGapRow(worth);
    return [
      { group: "You receive", label: "LP received", value: lp(liquidity), sub: `≈ ${musd(worth.value)} at the BTC price · at least ${lp(minLpOut)}` },
      ...(gap ? [{ group: "You receive", ...gap }] : []),
    ];
  };
  if (btcQuote && btcMinimums) {
    return [
      { group: "You pay", label: "You deposit", value: btcFine(btcQuote.btcIn) },
      { ...fee, group: "You pay", value: btcFine(btcQuote.fee) },
      {
        group: "You receive",
        label: "Swapped to MUSD",
        value: btcFine(btcQuote.btcToSwap),
        sub: `at least ${musd(btcMinimums.minMusdFromSwap)}`,
      },
      {
        group: "You receive",
        label: "Pool deposit",
        value: (
          <>
            <span className="block">{musd(btcQuote.musdAdded)}</span>
            <span className="block">+ {btcFine(btcQuote.btcAdded)}</span>
          </>
        ),
        sub: `at least ${musd(btcMinimums.minMusdAdded)} + ${btcFine(btcMinimums.minBtcAdded)}`,
      },
      ...received(entryWorth(btcQuote, price, (btcQuote.btcIn * price) / WAD), btcQuote.liquidity, btcMinimums.minLpOut),
      ...tail,
    ];
  }
  if (!quote || !minimums) return tail;
  return [
    {
      group: "You pay",
      label: preview.borrow ? "You borrow and deposit" : "You deposit",
      value: musd(quote.musdIn),
    },
    { ...fee, group: "You pay", value: musd(quote.fee) },
    ...(preview.borrow?.effect
      ? [{ group: "You pay", label: "Borrowing fee", value: musd(preview.borrow.effect.fee), sub: "added to your Trove debt" }]
      : []),
    { group: "You receive", label: "Swapped to BTC", value: musd(quote.musdToSwap), sub: `at least ${btc(minimums.minBtcFromSwap)}` },
    {
      group: "You receive",
      label: "Pool deposit",
      value: (
        <>
          <span className="block">{musd(quote.musdAdded)}</span>
          <span className="block">+ {btc(quote.btcAdded)}</span>
        </>
      ),
      sub: `at least ${musd(minimums.minMusdAdded)} + ${btc(minimums.minBtcAdded)}`,
    },
    ...received(entryWorth(quote, price, quote.musdIn), quote.liquidity, minimums.minLpOut),
    ...(preview.borrow?.effect
      ? [
          {
            group: "Your Trove after",
            label: (
              <>
                <Term id="trove">Trove</Term> debt
              </>
            ),
            value: musd(preview.borrow.effect.newDebt),
          },
          {
            group: "Your Trove after",
            label: (
              <>
                <Term id="collateralRatio">Collateral ratio</Term>
              </>
            ),
            value: preview.borrow.effect.newCr === null ? "—" : formatPercent(preview.borrow.effect.newCr, 1),
          },
        ]
      : []),
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
