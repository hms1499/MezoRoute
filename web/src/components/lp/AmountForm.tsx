import { formatUnits } from "viem";
import { formatBps, formatToken } from "@/lib/format";
import { SLIPPAGE_PRESETS, type SlippageBps } from "@/lib/quote/entry";

type Inputs = { amount: string; slippageBps: SlippageBps };

export function AmountForm({
  amount,
  slippageBps,
  walletMusd,
  onChange,
}: Inputs & { walletMusd: bigint; onChange: (next: Inputs) => void }) {
  return (
    <div className="mt-4 space-y-3">
      <label htmlFor="amount" className="block text-sm font-medium">
        Amount
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 focus-within:border-accent">
        <input
          id="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          value={amount}
          onChange={(event) => onChange({ amount: event.target.value, slippageBps })}
          className="min-w-0 flex-1 bg-transparent text-lg outline-none"
        />
        <span className="text-sm text-muted">MUSD</span>
        <button
          type="button"
          onClick={() => onChange({ amount: formatUnits(walletMusd, 18), slippageBps })}
          className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
        >
          Max
        </button>
      </div>
      <p className="text-xs text-muted">In your wallet: {formatToken(walletMusd, 18, 2)} MUSD</p>
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
