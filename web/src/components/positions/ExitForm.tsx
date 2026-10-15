import { lp } from "@/components/lp/units";
import { Notice } from "@/components/ui/Notice";
import { formatBps } from "@/lib/format";
import { EXIT_PERCENTS, type ExitIntent } from "@/lib/positions/exit-intent";
import { SLIPPAGE_PRESETS } from "@/lib/quote/entry";

const chip = (on: boolean) =>
  on
    ? "min-h-9 rounded-full bg-accent px-3.5 text-sm font-semibold text-white"
    : "min-h-9 rounded-full border border-line bg-white px-3.5 text-sm font-semibold text-muted hover:text-ink";

/** Share of the LP (locked once the first step pins it; "Start over" unlocks it) and slippage (read again at send). */
export function ExitForm({
  intent,
  lpBalance,
  amountLocked,
  onChange,
}: {
  intent: ExitIntent;
  lpBalance: bigint;
  amountLocked: boolean;
  onChange: (next: ExitIntent) => void;
}) {
  return (
    <div className="space-y-4">
      <fieldset disabled={amountLocked}>
        <legend className="text-sm font-medium">Amount to exit</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {EXIT_PERCENTS.map((percent) => (
            <button
              key={percent}
              type="button"
              aria-pressed={percent === intent.percent}
              onClick={() => onChange({ ...intent, percent })}
              className={chip(percent === intent.percent)}
            >
              {percent === 100 ? "Max" : `${percent}%`}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">Your LP: {lp(lpBalance)}</p>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">Slippage</legend>
        <div className="mt-1 flex gap-2">
          {SLIPPAGE_PRESETS.map((bps) => (
            <button
              key={bps.toString()}
              type="button"
              aria-pressed={bps === intent.slippageBps}
              onClick={() => onChange({ ...intent, slippageBps: bps })}
              className={chip(bps === intent.slippageBps)}
            >
              {formatBps(bps, 1)}
            </button>
          ))}
        </div>
        {intent.slippageBps === 200n && (
          <Notice tone="warning" className="mt-2">
            2% slippage lets this exit fill up to 2% below the quote. Use it only if lower settings keep failing.
          </Notice>
        )}
      </fieldset>
    </div>
  );
}
