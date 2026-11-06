import { formatBps } from "@/lib/format";
import { EXIT_PERCENTS, type ExitPercent } from "@/lib/positions/exit-intent";
import { SLIPPAGE_PRESETS, type SlippageBps } from "@/lib/quote/entry";
import { Segmented } from "./Segmented";

// U11 §5.6: the slippage and share presets are segmented controls like every other choice (no fourth style).

/** 0.5% | 1% | 2%, for entries and exits. */
export function SlippageChoice({ value, onChange }: { value: SlippageBps; onChange: (bps: SlippageBps) => void }) {
  return (
    <Segmented
      label="Slippage"
      options={SLIPPAGE_PRESETS.map((bps) => ({ value: bps.toString(), label: formatBps(bps, 1) }))}
      value={value.toString()}
      onChange={(next) => onChange(SLIPPAGE_PRESETS.find((bps) => bps.toString() === next) ?? value)}
    />
  );
}

/** 25% | 50% | 75% | Max, for the LP exit and the Stability Pool withdrawal. */
export function PercentChoice({ label, value, onChange }: { label: string; value: ExitPercent; onChange: (percent: ExitPercent) => void }) {
  return (
    <Segmented
      label={label}
      options={EXIT_PERCENTS.map((percent) => ({ value: String(percent), label: percent === 100 ? "Max" : `${percent}%` }))}
      value={String(value)}
      onChange={(next) => onChange(EXIT_PERCENTS.find((percent) => String(percent) === next) ?? value)}
    />
  );
}
