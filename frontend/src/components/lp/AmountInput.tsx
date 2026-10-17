import { formatUnits } from "viem";
import { formatToken } from "@/lib/format";

/** A MUSD amount with Max; shared by the LP and Stability Pool routes. */
export function AmountInput({
  amount,
  max,
  maxLabel,
  onAmount,
}: {
  amount: string;
  max: bigint;
  maxLabel: string;
  onAmount: (amount: string) => void;
}) {
  return (
    <div className="space-y-3">
      <label htmlFor="amount" className="block text-sm font-medium">
        Amount
      </label>
      <div className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-well px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        <input
          id="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          value={amount}
          aria-describedby="amount-help"
          onChange={(event) => onAmount(event.target.value)}
          className="min-w-0 flex-1 bg-transparent py-2 text-xl font-semibold outline-none placeholder:text-muted/60"
        />
        <span className="text-sm text-muted">MUSD</span>
        <button
          type="button"
          onClick={() => onAmount(formatUnits(max, 18))}
          className="min-h-9 rounded-full bg-accent-soft px-3 text-xs font-semibold text-accent hover:bg-accent/10"
        >
          Max
        </button>
      </div>
      <p id="amount-help" className="text-xs text-muted">
        {maxLabel}: {formatToken(max, 18, 2)} MUSD
      </p>
    </div>
  );
}
