import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Stat } from "@/components/ui/Stat";
import { Term } from "@/components/ui/Term";
import { formatBps, formatPercent } from "@/lib/format";
import { entryValue } from "@/lib/quote/entry";
import { QUOTE_TTL_MS } from "@/lib/routes/musd-btc-lp/gate";
import type { EntryPreview } from "@/lib/routes/musd-btc-lp/preview";
import type { LpRouteData } from "@/lib/routes/musd-btc-lp/snapshot";
import { QUOTE_REFRESH_MS } from "@/lib/routes/musd-btc-lp/useLpRouteSnapshot";
import { cx } from "@/lib/ui/cx";
import { quoteTimer } from "@/lib/ui/countdown";
import { btc, lp, musd } from "./units";

/** Exact amounts, minimums, deadline, and the quote's age (spec §9 screen 3a). */
export function ConfirmSummary({
  preview,
  data,
  slippageBps,
  now,
  onRefresh,
}: {
  preview: EntryPreview;
  data: LpRouteData;
  slippageBps: bigint;
  now: number;
  onRefresh: () => void;
}) {
  const { quote, minimums } = preview;
  const timer = quoteTimer(now, data.fetchedAt, QUOTE_REFRESH_MS, QUOTE_TTL_MS);
  return (
    <Card title={preview.borrow ? "Review your borrow and deposit" : "Review your deposit"} headingLevel={1}>
      {quote && minimums && (
        <dl className="mt-3 stat-list">
          <Stat label={preview.borrow ? "You borrow and deposit" : "You deposit"} strong>
            {musd(quote.musdIn)}
          </Stat>
          <Stat label="MezoRoute fee" sub={formatBps(data.snapshot.executorFeeBps)}>
            {musd(quote.fee)}
          </Stat>
          {preview.borrow?.effect && (
            <>
              <Stat label="Borrowing fee" sub="added to your Trove debt">
                {musd(preview.borrow.effect.fee)}
              </Stat>
              <Stat
                label={
                  <>
                    <Term id="trove">Trove</Term> debt after
                  </>
                }
              >{musd(preview.borrow.effect.newDebt)}</Stat>
              <Stat
                label={
                  <>
                    <Term id="collateralRatio">Collateral ratio</Term> after
                  </>
                }
                strong
              >
                {preview.borrow.effect.newCr === null ? "—" : formatPercent(preview.borrow.effect.newCr, 1)}
              </Stat>
            </>
          )}
          <Stat label="Swapped to BTC" sub={`at least ${btc(minimums.minBtcFromSwap)}`}>
            {musd(quote.musdToSwap)}
          </Stat>
          <Stat label="Deposited to the pool" sub={`at least ${musd(minimums.minMusdAdded)} + ${btc(minimums.minBtcAdded)}`}>
            {musd(quote.musdAdded)} + {btc(quote.btcAdded)}
          </Stat>
          <Stat label="LP tokens" sub={`≈ ${musd(entryValue(data.snapshot.pool, quote))} at the pool price · at least ${lp(minimums.minLpOut)}`}>
            {lp(quote.liquidity)}
          </Stat>
          <Stat label="Slippage">{formatBps(slippageBps, 1)}</Stat>
          <Stat label="Deadline" sub="10 minutes after this quote's block">
            {new Date(Number(preview.deadline) * 1000).toLocaleTimeString()}
          </Stat>
        </dl>
      )}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <span>Quote from block {data.snapshot.blockNumber.toString()}</span>
          {timer.phase === "expired" ? (
            <Button size="sm" variant="secondary" onClick={onRefresh}>
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
            className={cx(
              "h-full origin-left transition-transform duration-1000 ease-linear",
              timer.phase === "expiring" ? "bg-warning-ink" : "bg-accent",
            )}
            style={{ transform: `scaleX(${timer.remaining})` }}
          />
        </div>
      </div>
      <Notice className="mt-4">MezoRoute never holds your funds between transactions.</Notice>
    </Card>
  );
}
