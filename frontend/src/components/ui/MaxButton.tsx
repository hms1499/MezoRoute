import { cx } from "@/lib/ui/cx";

/** U11 §5.6: the one Max, an sm pill in accent on accent-soft, placed inside an amount field on the right. */
export function MaxButton({ onClick, label = "Max", disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "hit inline-flex shrink-0 items-center rounded-pill font-semibold min-h-7 px-3 text-xs",
        "bg-accent-soft text-accent hover:bg-accent-tint disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      {label}
    </button>
  );
}
