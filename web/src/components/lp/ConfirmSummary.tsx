import { StatRow } from "@/components/dashboard/StatRow";
import { formatBps } from "@/lib/format";
import { QUOTE_TTL_MS } from "@/lib/routes/musd-btc-lp/gate";
import type { EntryPreview } from "@/lib/routes/musd-btc-lp/preview";
import type { LpRouteData } from "@/lib/routes/musd-btc-lp/snapshot";
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
  const age = Math.max(0, Math.floor((now - data.fetchedAt) / 1000));
  const expired = now - data.fetchedAt > QUOTE_TTL_MS;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h1 className="text-lg font-semibold">Review your deposit</h1>
      {quote && minimums && (
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
          <StatRow label="You deposit" strong>
            {musd(quote.musdIn)}
          </StatRow>
          <StatRow label="MezoRoute fee" sub={formatBps(data.snapshot.executorFeeBps)}>
            {musd(quote.fee)}
          </StatRow>
          <StatRow label="Swapped to BTC" sub={`at least ${btc(minimums.minBtcFromSwap)}`}>
            {musd(quote.musdToSwap)}
          </StatRow>
          <StatRow label="Deposited to the pool" sub={`at least ${musd(minimums.minMusdAdded)} + ${btc(minimums.minBtcAdded)}`}>
            {musd(quote.musdAdded)} + {btc(quote.btcAdded)}
          </StatRow>
          <StatRow label="LP tokens" sub={`at least ${lp(minimums.minLpOut)}`}>
            {lp(quote.liquidity)}
          </StatRow>
          <StatRow label="Slippage">{formatBps(slippageBps, 1)}</StatRow>
          <StatRow label="Deadline" sub="10 minutes after this quote's block">
            {new Date(Number(preview.deadline) * 1000).toLocaleTimeString()}
          </StatRow>
        </dl>
      )}
      <p className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>
          Quote from block {data.snapshot.blockNumber.toString()} · {age}s ago
        </span>
        {expired && (
          <button type="button" onClick={onRefresh} className="font-semibold text-accent hover:underline">
            Refresh quote
          </button>
        )}
      </p>
      <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
        MezoRoute never holds your funds between transactions.
      </p>
    </section>
  );
}
