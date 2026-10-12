import { lp } from "@/components/lp/units";
import { formatBps } from "@/lib/format";
import { EXIT_PERCENTS, type ExitIntent } from "@/lib/positions/exit-intent";
import { SLIPPAGE_PRESETS } from "@/lib/quote/entry";

const pill = (on: boolean) =>
  on ? "rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white" : "rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted";

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
    <div className="mt-4 space-y-3">
      <fieldset disabled={amountLocked}>
        <legend className="text-sm font-medium">Amount to exit</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {EXIT_PERCENTS.map((percent) => (
            <button
              key={percent}
              type="button"
              aria-pressed={percent === intent.percent}
              onClick={() => onChange({ ...intent, percent })}
              className={pill(percent === intent.percent)}
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
              className={pill(bps === intent.slippageBps)}
            >
              {formatBps(bps, 1)}
            </button>
          ))}
        </div>
        {intent.slippageBps === 200n && (
          <p className="mt-2 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning-ink">
            2% slippage lets this exit fill up to 2% below the quote. Use it only if lower settings keep failing.
          </p>
        )}
      </fieldset>
    </div>
  );
}
