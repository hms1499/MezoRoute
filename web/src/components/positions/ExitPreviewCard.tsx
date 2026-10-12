import { StatRow } from "@/components/dashboard/StatRow";
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
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Estimated result</h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="LP to exit">{lp(quote.liquidityIn)}</StatRow>
        <StatRow label="MUSD from the pool">{musd(quote.musdRemoved)}</StatRow>
        <StatRow label="BTC from the pool">{btc(quote.btcRemoved)}</StatRow>
        <StatRow label="MUSD from selling the BTC">{musd(quote.musdFromSwap)}</StatRow>
        <StatRow label="You receive (estimated)" strong>
          {musd(quote.musdOut)}
        </StatRow>
        <StatRow label="Minimum you receive">{musd(minimums.minMusdOut)}</StatRow>
        <StatRow label="Price impact">{formatPercent(quote.priceImpact, 2)}</StatRow>
        <StatRow label="MezoRoute fee">None on exit</StatRow>
        <StatRow label="Network fee (estimated)">{gasCost === null ? "—" : btc(gasCost)}</StatRow>
      </dl>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
        <li>Unclaimed pool fees stay claimable after you exit.</li>
        <li>The BTC half is sold for MUSD at the pool price; the minimum protects you from a worse fill.</li>
        <li>Quote from block {blockNumber.toString()}; it refreshes every 15 seconds and again before sending.</li>
      </ul>
    </section>
  );
}
