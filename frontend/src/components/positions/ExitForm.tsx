import { lp } from "@/components/lp/units";
import { Notice } from "@/components/ui/Notice";
import { PercentChoice, SlippageChoice } from "@/components/ui/Presets";
import type { ExitIntent } from "@/lib/positions/exit-intent";

/** Share of the LP (locked once the first step pins it; "Start over" unlocks it) and slippage (read again at send). */
export function ExitForm({
  intent,
  walletLp,
  stakedLp,
  amountLocked,
  onChange,
}: {
  intent: ExitIntent;
  walletLp: bigint;
  stakedLp: bigint;
  amountLocked: boolean;
  onChange: (next: ExitIntent) => void;
}) {
  return (
    <div className="space-y-4">
      <fieldset disabled={amountLocked}>
        <legend className="text-sm font-medium">Amount to exit</legend>
        <div className="mt-1">
          <PercentChoice label="Amount to exit" value={intent.percent} onChange={(percent) => onChange({ ...intent, percent })} />
        </div>
        <p className="mt-1 text-xs text-muted">
          Your LP: {lp(walletLp + stakedLp)}
          {stakedLp > 0n && (walletLp === 0n ? ", all staked in the gauge" : `, ${lp(stakedLp)} of it staked in the gauge`)}
        </p>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">Slippage</legend>
        <div className="mt-1">
          <SlippageChoice value={intent.slippageBps} onChange={(bps) => onChange({ ...intent, slippageBps: bps })} />
        </div>
        {intent.slippageBps === 200n && (
          <Notice tone="warning" className="mt-2">
            2% slippage lets this exit fill up to 2% below the quote. Use it only if lower settings keep failing.
          </Notice>
        )}
      </fieldset>
    </div>
  );
}
