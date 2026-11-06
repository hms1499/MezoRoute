import { formatUnits } from "viem";
import { formatToken } from "@/lib/format";
import type { EntryAsset } from "@/lib/routes/musd-btc-lp/asset";
import { MaxButton } from "@/components/ui/MaxButton";

/**
 * The Stability Pool's amount with Max (U11 Task 16 replaces it with TokenAmountInput).
 */
export function AmountInput({
  amount,
  max,
  maxLabel,
  onAmount,
  asset = "musd",
  balance = max,
  note,
}: {
  amount: string;
  max: bigint;
  maxLabel: string;
  onAmount: (amount: string) => void;
  asset?: EntryAsset;
  /** The balance the line under the input shows; Max may fill in less (BTC keeps its gas reserve). */
  balance?: bigint;
  note?: string;
}) {
  const unit = asset === "btc" ? "BTC" : "MUSD";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="amount" className="block text-sm font-medium">
          Amount
        </label>
      </div>
      <div className="flex min-h-12 items-center gap-2 rounded-inset border border-line bg-well px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
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
        <span className="text-sm text-muted">{unit}</span>
        <MaxButton onClick={() => onAmount(formatUnits(max, 18))} />
      </div>
      <p id="amount-help" className="text-xs text-muted">
        {maxLabel}: {asset === "btc" ? formatToken(balance, 18, 6) : formatToken(balance, 18, 2)} {unit}
        {note ? ` · ${note}` : ""}
      </p>
    </div>
  );
}
