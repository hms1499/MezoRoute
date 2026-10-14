import { formatBps } from "@/lib/format";
import { SLIPPAGE_PRESETS, type SlippageBps } from "@/lib/quote/entry";
import { AmountInput } from "./AmountInput";

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
              className={
                bps === slippageBps
                  ? "rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white"
                  : "rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted"
              }
            >
              {formatBps(bps, 1)}
            </button>
          ))}
        </div>
        {slippageBps === 200n && (
          <p className="mt-2 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning-ink">
            2% slippage lets this deposit fill up to 2% below the quote. Use it only if lower settings keep failing.
          </p>
        )}
      </fieldset>
    </div>
  );
}
