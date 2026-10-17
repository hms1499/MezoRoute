import { Term } from "@/components/ui/Term";
import type { EntryMode } from "@/lib/routes/musd-btc-lp/intent";
import { borrowMode } from "@/lib/routes/musd-btc-lp/mode";
import type { WalletKind } from "@/lib/wallet/capabilities";

const BORROW_LABEL = "Borrow & Deploy";

/** The tab is a radio button, so the term's definition sits on the note under it (U8); every note starts with the label. */
function withTerm(note: string) {
  if (!note.startsWith(BORROW_LABEL)) return note;
  return (
    <>
      <Term id="borrowAndDeploy">{BORROW_LABEL}</Term>
      {note.slice(BORROW_LABEL.length)}
    </>
  );
}

/** Deposit wallet MUSD, or Borrow & Deploy (EOAs with an open Trove, FR-23). */
export function ModeToggle({
  walletKind,
  hasTrove,
  mode,
  onChange,
}: {
  walletKind: WalletKind | undefined;
  hasTrove: boolean | undefined;
  mode: EntryMode;
  onChange: (mode: EntryMode) => void;
}) {
  const borrow = borrowMode(walletKind, hasTrove);
  const option = (value: EntryMode, label: string, disabled = false) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      disabled={disabled}
      onClick={() => onChange(value)}
      className={
        mode === value
          ? "min-h-9 rounded-full bg-line px-3.5 text-ink"
          : "min-h-9 rounded-full px-3.5 text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {label}
    </button>
  );
  return (
    <div>
      <div role="radiogroup" aria-label="Funding" className="inline-flex rounded-full bg-well p-1 text-sm font-semibold">
        {option("deposit", "Deposit MUSD")}
        {option("borrow", BORROW_LABEL, borrow.disabled)}
      </div>
      {borrow.note && <p className="mt-1 text-sm text-muted">{withTerm(borrow.note)}</p>}
      {mode === "borrow" && !borrow.disabled && (
        <p className="mt-1 text-sm text-muted">Borrow MUSD against your Trove and deposit it in one transaction.</p>
      )}
    </div>
  );
}
