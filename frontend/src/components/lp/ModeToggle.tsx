import { Segmented } from "@/components/ui/Segmented";
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
  return (
    <div>
      <Segmented
        label="Funding"
        options={[
          { value: "deposit", label: "Deposit" },
          { value: "borrow", label: BORROW_LABEL, disabled: borrow.disabled, describedBy: borrow.note ? "funding-note" : undefined },
        ]}
        value={mode}
        onChange={onChange}
      />
      {borrow.note && <p id="funding-note" className="mt-1 text-sm text-muted">{withTerm(borrow.note)}</p>}
      {mode === "borrow" && !borrow.disabled && (
        <p className="mt-1 text-sm text-muted">Borrow MUSD against your Trove and deposit it in one transaction.</p>
      )}
    </div>
  );
}
