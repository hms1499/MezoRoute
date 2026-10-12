import type { WalletKind } from "@/lib/wallet/capabilities";

/** Deposit MUSD is the only mode in F3; Borrow & Deploy arrives in F4 (and never for smart accounts). */
export function ModeToggle({ walletKind }: { walletKind: WalletKind | undefined }) {
  const reason =
    walletKind === "smart-account"
      ? "Borrow & Deploy needs a standard wallet signature."
      : "Borrow & Deploy is coming next.";
  return (
    <div className="mt-4">
      <div role="radiogroup" aria-label="Funding" className="inline-flex rounded-full bg-line p-1 text-xs font-semibold">
        <button type="button" role="radio" aria-checked="true" className="rounded-full bg-white px-3 py-1.5 shadow-sm">
          Deposit MUSD
        </button>
        <button type="button" role="radio" aria-checked="false" disabled className="rounded-full px-3 py-1.5 text-muted opacity-60">
          Borrow &amp; Deploy
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">{reason}</p>
    </div>
  );
}
