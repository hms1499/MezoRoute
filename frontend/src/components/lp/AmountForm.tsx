import { Notice } from "@/components/ui/Notice";
import { SlippageChoice } from "@/components/ui/Presets";
import type { SlippageBps } from "@/lib/quote/entry";
import type { EntryAsset } from "@/lib/routes/musd-btc-lp/asset";
import { AmountInput } from "./AmountInput";

type Inputs = { amount: string; slippageBps: SlippageBps };

export function AmountForm({
  amount,
  slippageBps,
  max,
  maxLabel,
  onChange,
  asset,
  onAsset,
  balance,
  note,
}: Inputs & {
  max: bigint;
  maxLabel: string;
  onChange: (next: Inputs) => void;
  asset?: EntryAsset;
  onAsset?: (asset: EntryAsset) => void;
  balance?: bigint;
  note?: string;
}) {
  return (
    <div className="mt-4 space-y-3">
      <AmountInput
        amount={amount}
        max={max}
        maxLabel={maxLabel}
        asset={asset}
        onAsset={onAsset}
        balance={balance}
        note={note}
        onAmount={(next) => onChange({ amount: next, slippageBps })}
      />
      <fieldset>
        <legend className="text-sm font-medium">Slippage</legend>
        <div className="mt-1">
          <SlippageChoice value={slippageBps} onChange={(bps) => onChange({ amount, slippageBps: bps })} />
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
