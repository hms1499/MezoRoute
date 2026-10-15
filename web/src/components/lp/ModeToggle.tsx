import type { EntryMode } from "@/lib/routes/musd-btc-lp/intent";
import { walletCapabilities, type WalletKind } from "@/lib/wallet/capabilities";

/** Deposit wallet MUSD, or Borrow & Deploy (EOAs only, FR-23). */
export function ModeToggle({
  walletKind,
  mode,
  onChange,
}: {
  walletKind: WalletKind | undefined;
  mode: EntryMode;
  onChange: (mode: EntryMode) => void;
}) {
  const canBorrow = walletKind !== undefined && walletCapabilities(walletKind).borrowAndDeploy;
  const option = (value: EntryMode, label: string, disabled = false) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      disabled={disabled}
      onClick={() => onChange(value)}
      className={
        mode === value
          ? "min-h-9 rounded-full bg-white px-3.5 text-ink shadow-card"
          : "min-h-9 rounded-full px-3.5 text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {label}
    </button>
  );
  return (
    <div>
      <div role="radiogroup" aria-label="Funding" className="inline-flex rounded-full bg-line p-1 text-sm font-semibold">
        {option("deposit", "Deposit MUSD")}
        {option("borrow", "Borrow & Deploy", !canBorrow)}
      </div>
      {walletKind === "smart-account" && (
        <p className="mt-1 text-sm text-muted">Borrow & Deploy needs a standard wallet signature.</p>
      )}
      {mode === "borrow" && (
        <p className="mt-1 text-sm text-muted">Borrow MUSD against your Trove and deposit it in one transaction.</p>
      )}
    </div>
  );
}
