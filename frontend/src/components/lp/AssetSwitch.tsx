import type { EntryAsset } from "@/lib/routes/musd-btc-lp/asset";

/** MUSD | BTC for a deposit: what the user puts in. Borrow & Deploy always brings MUSD, so the page hides this there. */
export function AssetSwitch({ asset, onChange }: { asset: EntryAsset; onChange: (asset: EntryAsset) => void }) {
  const option = (value: EntryAsset, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={asset === value}
      onClick={() => onChange(value)}
      className={
        asset === value
          ? "min-h-9 rounded-full bg-line px-4 text-ink"
          : "min-h-9 rounded-full px-4 text-muted hover:text-ink"
      }
    >
      {label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Deposit asset" className="inline-flex rounded-full bg-well p-1 text-sm font-semibold">
      {option("musd", "MUSD")}
      {option("btc", "BTC")}
    </div>
  );
}
