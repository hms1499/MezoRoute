import { Segmented } from "@/components/ui/Segmented";
import { Term } from "@/components/ui/Term";
import type { EntryMode } from "@/lib/routes/musd-btc-lp/intent";
import { borrowMode } from "@/lib/routes/musd-btc-lp/mode";
import type { WalletKind } from "@/lib/wallet/capabilities";

const BORROW_LABEL = "Borrow & Deploy";
/** U13: no wallet, no Trove to read, so borrowing waits for the connection. */
const CONNECT_TO_BORROW = "Borrow & Deploy needs a connected wallet with a Trove.";

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
  connected = true,
}: {
  walletKind: WalletKind | undefined;
  hasTrove: boolean | undefined;
  mode: EntryMode;
  onChange: (mode: EntryMode) => void;
  /** U13: false on the read-only planner, which knows no wallet and therefore no Trove. */
  connected?: boolean;
}) {
  const borrow = connected ? borrowMode(walletKind, hasTrove) : { disabled: true, note: CONNECT_TO_BORROW };
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
    </div>
  );
}
