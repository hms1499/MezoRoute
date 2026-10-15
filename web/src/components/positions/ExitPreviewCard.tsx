import { Stat } from "@/components/ui/Stat";
import { btc, lp, musd } from "@/components/lp/units";
import { formatPercent } from "@/lib/format";
import type { ExitMinimums, ExitQuote } from "@/lib/quote/exit";

/** FR-09: removal amounts, swap output, expected and minimum MUSD, gas; no fee on exit. */
export function ExitPreviewCard({
  quote,
  minimums,
  gasCost,
  blockNumber,
}: {
  quote: ExitQuote;
  minimums: ExitMinimums;
  gasCost: bigint | null;
  blockNumber: bigint;
}) {
  return (
    <section className="card">
      <h2 className="font-semibold">Estimated result</h2>
      <dl className="mt-3 stat-list">
        <Stat label="LP to exit">{lp(quote.liquidityIn)}</Stat>
        <Stat label="MUSD from the pool">{musd(quote.musdRemoved)}</Stat>
        <Stat label="BTC from the pool">{btc(quote.btcRemoved)}</Stat>
        <Stat label="MUSD from selling the BTC">{musd(quote.musdFromSwap)}</Stat>
        <Stat label="You receive (estimated)" strong>
          {musd(quote.musdOut)}
        </Stat>
        <Stat label="Minimum you receive">{musd(minimums.minMusdOut)}</Stat>
        <Stat label="Price impact">{formatPercent(quote.priceImpact, 2)}</Stat>
        <Stat label="MezoRoute fee">None on exit</Stat>
        <Stat label="Network fee (estimated)">{gasCost === null ? "—" : btc(gasCost)}</Stat>
      </dl>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
        <li>Unclaimed pool fees stay claimable after you exit.</li>
        <li>The BTC half is sold for MUSD at the pool price; the minimum protects you from a worse fill.</li>
        <li>Quote from block {blockNumber.toString()}; it refreshes every 15 seconds and again before sending.</li>
      </ul>
    </section>
  );
}
