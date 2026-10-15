import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Stat } from "@/components/ui/Stat";
import { formatBps, formatPercent } from "@/lib/format";
import { QUOTE_TTL_MS } from "@/lib/routes/musd-btc-lp/gate";
import type { EntryPreview } from "@/lib/routes/musd-btc-lp/preview";
import type { LpRouteData } from "@/lib/routes/musd-btc-lp/snapshot";
import { quoteCountdown } from "@/lib/ui/countdown";
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
  const countdown = quoteCountdown(now, data.fetchedAt, QUOTE_TTL_MS);
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
              <Stat label="Trove debt after">{musd(preview.borrow.effect.newDebt)}</Stat>
              <Stat label="Collateral ratio after" strong>
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
          <Stat label="LP tokens" sub={`at least ${lp(minimums.minLpOut)}`}>
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
          {countdown.expired ? (
            <Button size="sm" variant="secondary" onClick={onRefresh}>
              Refresh quote
            </Button>
          ) : (
            <span>Expires in {countdown.secondsLeft}s</span>
          )}
        </div>
        <div aria-hidden className="mt-2 h-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full origin-left bg-accent transition-transform duration-1000 ease-linear"
            style={{ transform: `scaleX(${countdown.remaining})` }}
          />
        </div>
      </div>
      <Notice className="mt-4">MezoRoute never holds your funds between transactions.</Notice>
    </Card>
  );
}
