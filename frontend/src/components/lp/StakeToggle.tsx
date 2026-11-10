import { STAKE_TITLE } from "@/lib/gauge/copy";
import { cx } from "@/lib/ui/cx";

/**
 * "Stake for MEZO": the switch on the LP overview's Staking row (U14 B2), staking the LP in the pool's gauge in the
 * same transaction. The row carries the copy (`stakeRowCopy`) and the gauge term on its label (U8: never in a switch).
 */
export function StakeSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={STAKE_TITLE}
      onClick={() => onChange(!on)}
      className="hit relative inline-flex h-6 w-11 shrink-0 align-middle"
    >
      <span aria-hidden className={cx("absolute inset-0 rounded-full transition-colors", on ? "bg-accent" : "bg-line")} />
      <span aria-hidden className={cx("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface transition-transform", on && "translate-x-5")} />
    </button>
  );
}
