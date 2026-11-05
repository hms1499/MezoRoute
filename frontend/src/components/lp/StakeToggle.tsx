import { Card } from "@/components/ui/Card";
import type { StakeAvailability } from "@/lib/gauge/availability";
import { STAKE_TITLE, stakeLines } from "@/lib/gauge/copy";
import { cx } from "@/lib/ui/cx";

/**
 * "Stake to earn MEZO": stake the LP in the pool's gauge in the same transaction. Hidden when the gauge
 * is not alive. Between reward weeks the switch stays on and only the rate is missing. Rates here are
 * always this week's, and the copy always says swap fees go to veBTC voters while staked.
 */
export function StakeToggle({
  availability,
  on,
  onChange,
  mezoPerWeek,
  aprLabel,
}: {
  availability: StakeAvailability;
  on: boolean;
  onChange: (on: boolean) => void;
  /** MEZO per week for this deposit at this week's rate; null between weeks. */
  mezoPerWeek: bigint | null;
  /** "12.3%" when a MEZO price is known (mainnet), else null. */
  aprLabel: string | null;
}) {
  if (availability === "unavailable") return null;
  const lines = stakeLines(availability, mezoPerWeek);
  return (
    <Card>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-describedby="stake-copy"
        onClick={() => onChange(!on)}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-base font-semibold">{STAKE_TITLE}</span>
        <span aria-hidden className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-accent" : "bg-line")}>
          <span
            className={cx("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface transition-transform", on && "translate-x-5")}
          />
        </span>
      </button>
      <div id="stake-copy" className="mt-1 space-y-1 text-sm text-muted">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {on && availability === "open" && aprLabel !== null && <p>Emissions APR ≈ {aprLabel} at this week&apos;s rate.</p>}
      </div>
    </Card>
  );
}
