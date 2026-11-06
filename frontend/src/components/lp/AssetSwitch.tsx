import { Segmented } from "@/components/ui/Segmented";
import type { EntryAsset } from "@/lib/routes/musd-btc-lp/asset";

/** MUSD | BTC for a deposit: what the user puts in. Borrow & Deploy always brings MUSD, so the page hides this there. */
export function AssetSwitch({ asset, onChange }: { asset: EntryAsset; onChange: (asset: EntryAsset) => void }) {
  return (
    <Segmented
      label="Deposit asset"
      options={[
        { value: "musd", label: "MUSD" },
        { value: "btc", label: "BTC" },
      ]}
      value={asset}
      onChange={onChange}
    />
  );
}
