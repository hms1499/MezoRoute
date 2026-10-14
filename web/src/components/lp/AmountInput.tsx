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
      <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 focus-within:border-accent">
        <input
          id="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          value={amount}
          onChange={(event) => onAmount(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-lg outline-none"
        />
        <span className="text-sm text-muted">MUSD</span>
        <button
          type="button"
          onClick={() => onAmount(formatUnits(max, 18))}
          className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
        >
          Max
        </button>
      </div>
      <p className="text-xs text-muted">
        {maxLabel}: {formatToken(max, 18, 2)} MUSD
      </p>
    </div>
  );
}
