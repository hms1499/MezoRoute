import { Notice } from "@/components/ui/Notice";
import { Term } from "@/components/ui/Term";
import type { StakeAvailability } from "@/lib/gauge/availability";
import { GAUGE_READ_FAILED_ENTRY, STAKE_TITLE, stakeLines } from "@/lib/gauge/copy";
import { cx } from "@/lib/ui/cx";

/**
 * "Stake for MEZO": stake the LP in the pool's gauge in the same transaction. Hidden when the gauge
 * is not alive or not funded; a gauge that could not be read says so instead, because the deposit then goes unstaked. Between reward weeks the switch stays on and only the rate is missing. Rates here are
 * always this week's, and the copy always says swap fees go to veBTC voters while staked.
 */
export function StakeToggle({
  availability,
  on,
  onChange,
  mezoPerWeek,
  aprLabel,
  readFailed = false,
}: {
  availability: StakeAvailability;
  on: boolean;
  onChange: (on: boolean) => void;
  /** MEZO per week for this deposit at this week's rate; null between weeks. */
  mezoPerWeek: bigint | null;
  /** "12.3%" when a MEZO price is known (mainnet), else null. */
  aprLabel: string | null;
  readFailed?: boolean;
}) {
  if (availability === "unavailable") {
    return readFailed ? (
      <Notice tone="warning" role="status">
        {GAUGE_READ_FAILED_ENTRY}
      </Notice>
    ) : null;
  }
  const lines = stakeLines(availability, mezoPerWeek);
  // U11 §6.2: a row inside the action card; the term sits on the copy, never inside the switch (U8).
  return (
    <div className="rounded-inset border border-line px-4 py-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-describedby="stake-copy"
        onClick={() => onChange(!on)}
        className="hit flex min-h-9 w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-sm font-semibold">{STAKE_TITLE}</span>
        <span aria-hidden className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-accent" : "bg-line")}>
          <span
            className={cx("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface transition-transform", on && "translate-x-5")}
          />
        </span>
      </button>
      <div id="stake-copy" className="mt-1 space-y-1 text-sm text-muted">
        <p>
          Staking puts the LP in the pool&apos;s <Term id="gauge">gauge</Term>.
        </p>
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {on && availability === "open" && aprLabel !== null && <p>Emissions APR ≈ {aprLabel} at this week&apos;s rate.</p>}
      </div>
    </div>
  );
}
