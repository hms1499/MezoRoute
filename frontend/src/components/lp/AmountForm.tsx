import { Notice } from "@/components/ui/Notice";
import { formatBps } from "@/lib/format";
import { SLIPPAGE_PRESETS, type SlippageBps } from "@/lib/quote/entry";
import { AmountInput } from "./AmountInput";

const chip = (on: boolean) =>
  on
    ? "min-h-9 rounded-full bg-accent px-3.5 text-sm font-semibold text-onAccent"
    : "min-h-9 rounded-full border border-line px-3.5 text-sm font-semibold text-muted hover:text-ink";

type Inputs = { amount: string; slippageBps: SlippageBps };

export function AmountForm({
  amount,
  slippageBps,
  max,
  maxLabel,
  onChange,
}: Inputs & { max: bigint; maxLabel: string; onChange: (next: Inputs) => void }) {
  return (
    <div className="mt-4 space-y-3">
      <AmountInput amount={amount} max={max} maxLabel={maxLabel} onAmount={(next) => onChange({ amount: next, slippageBps })} />
      <fieldset>
        <legend className="text-sm font-medium">Slippage</legend>
        <div className="mt-1 flex gap-2">
          {SLIPPAGE_PRESETS.map((bps) => (
            <button
              key={bps.toString()}
              type="button"
              aria-pressed={bps === slippageBps}
              onClick={() => onChange({ amount, slippageBps: bps })}
              className={chip(bps === slippageBps)}
            >
              {formatBps(bps, 1)}
            </button>
          ))}
        </div>
        {slippageBps === 200n && (
          <Notice tone="warning" className="mt-2">
            2% slippage lets this deposit fill up to 2% below the quote. Use it only if lower settings keep failing.
          </Notice>
        )}
      </fieldset>
    </div>
  );
}
