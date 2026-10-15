import { Stat } from "@/components/ui/Stat";
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
    <section className="card">
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
      <dl className="mt-2 stat-list">
        <Stat label="Deposited to the pool" sub={`+ ${btc(quote.btcAdded)}`}>
          {musd(quote.musdAdded)}
        </Stat>
        <Stat label="LP tokens" sub={`at least ${lp(minimums.minLpOut)}`}>
          {lp(quote.liquidity)}
        </Stat>
        <Stat label="MezoRoute fee" sub={formatBps(feeBps)}>
          {musd(quote.fee)}
        </Stat>
        <Stat label="Price impact" sub="includes the pool's swap fee">
          {formatPercent(quote.priceImpact, 2)}
        </Stat>
        <Stat label="Network fee">{gasCost === null ? "—" : btc(gasCost)}</Stat>
      </dl>
    </section>
  );
}
