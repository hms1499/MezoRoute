import { StatRow } from "@/components/dashboard/StatRow";
import { formatBps, formatPercent } from "@/lib/format";
import type { EntryMinimums, EntryQuote } from "@/lib/quote/entry";
import { btc, lp, musd } from "./units";

/** "What happens" and the estimated outcome (Flow C step 1). */
export function EntryPreviewCard({
  quote,
  minimums,
  feeBps,
  gasCost,
  borrowFee,
}: {
  quote: EntryQuote;
  minimums: EntryMinimums;
  feeBps: bigint;
  gasCost: bigint | null;
  borrowFee?: bigint;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">What happens</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
        {borrowFee !== undefined && (
          <li>
            MezoRoute borrows {musd(quote.musdIn)} from your Trove; the {musd(borrowFee)} borrowing fee is added to your debt.
          </li>
        )}
        <li>
          MezoRoute takes its {formatBps(feeBps)} fee: {musd(quote.fee)}.
        </li>
        <li>
          {musd(quote.musdToSwap)} is swapped to about {btc(quote.btcFromSwap)} in the MUSD/BTC pool.
        </li>
        <li>Both are added to the pool and you receive LP tokens. Anything left over returns to your wallet in the same transaction.</li>
      </ol>
      <h3 className="mt-4 text-sm font-semibold">Estimated outcome</h3>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="Deposited to the pool" sub={`+ ${btc(quote.btcAdded)}`}>
          {musd(quote.musdAdded)}
        </StatRow>
        <StatRow label="LP tokens" sub={`at least ${lp(minimums.minLpOut)}`}>
          {lp(quote.liquidity)}
        </StatRow>
        <StatRow label="MezoRoute fee" sub={formatBps(feeBps)}>
          {musd(quote.fee)}
        </StatRow>
        <StatRow label="Price impact" sub="includes the pool's swap fee">
          {formatPercent(quote.priceImpact, 2)}
        </StatRow>
        <StatRow label="Network fee">{gasCost === null ? "—" : btc(gasCost)}</StatRow>
      </dl>
    </section>
  );
}
