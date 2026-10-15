import { Card } from "@/components/ui/Card";
import { formatBps } from "@/lib/format";
import type { EntryQuote } from "@/lib/quote/entry";
import { btc, musd } from "./units";

/** "What happens" (Flow C step 1); the numbers sit in the summary panel. */
export function EntryPreviewCard({ quote, feeBps, borrowFee }: { quote: EntryQuote; feeBps: bigint; borrowFee?: bigint }) {
  const steps = [
    ...(borrowFee !== undefined
      ? [`MezoRoute borrows ${musd(quote.musdIn)} from your Trove; the ${musd(borrowFee)} borrowing fee is added to your debt.`]
      : []),
    `MezoRoute takes its ${formatBps(feeBps)} fee: ${musd(quote.fee)}.`,
    `${musd(quote.musdToSwap)} is swapped to about ${btc(quote.btcFromSwap)} in the MUSD/BTC pool.`,
    "Both are added to the pool and you receive LP tokens. Anything left over returns to your wallet in the same transaction.",
  ];
  return (
    <Card title="What happens">
      <ol className="mt-3 space-y-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
              {index + 1}
            </span>
            <span className="text-muted">{step}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
