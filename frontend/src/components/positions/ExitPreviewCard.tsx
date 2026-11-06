import type { OverviewRow } from "@/components/flow/Overview";
import { btc, lp, musd } from "@/components/lp/units";
import { formatPercent } from "@/lib/format";
import type { ExitStepKind } from "@/lib/positions/exit-steps";
import type { ExitMinimums, ExitQuote } from "@/lib/quote/exit";

/** FR-09: removal amounts, swap output, price impact, gas; no fee on exit. U11 §6.2: says when the exit unstakes first. */
export function exitOverview({
  quote,
  minimums,
  steps,
  unstake,
  gasCost,
}: {
  quote: ExitQuote;
  minimums: ExitMinimums;
  steps: readonly ExitStepKind[];
  /** LP the gauge releases first; 0 when the wallet holds it all. */
  unstake: bigint;
  gasCost: bigint | null;
}): OverviewRow[] {
  return [
    { label: "LP to exit", value: lp(quote.liquidityIn) },
    ...(steps.includes("unstake") ? [{ label: "Unstake first", value: lp(unstake), sub: "from the gauge, in its own transaction" }] : []),
    { label: "MUSD from the pool", value: musd(quote.musdRemoved) },
    { label: "BTC from the pool", value: btc(quote.btcRemoved), sub: `sold for ${musd(quote.musdFromSwap)}` },
    { label: "Minimum you receive", value: musd(minimums.minMusdOut) },
    { label: "Price impact", value: formatPercent(quote.priceImpact, 2) },
    { label: "MezoRoute fee", value: "None on exit" },
    { label: "Network fee (estimated)", value: gasCost === null ? "—" : btc(gasCost) },
  ];
}

/** What the exit leaves as it was, behind Details. */
export function ExitNotes({ unstakeNote, blockNumber }: { unstakeNote: string | null; blockNumber: bigint }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
      {unstakeNote && <li>{unstakeNote}</li>}
      <li>Unclaimed pool fees stay claimable after you exit.</li>
      <li>The BTC half is sold for MUSD at the pool price; the minimum protects you from a worse fill.</li>
      <li>Quote from block {blockNumber.toString()}; it refreshes every 15 seconds and again before sending.</li>
    </ul>
  );
}
