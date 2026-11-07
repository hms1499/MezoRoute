"use client";

import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Segmented } from "@/components/ui/Segmented";
import { Term } from "@/components/ui/Term";
import { formatPercent } from "@/lib/format";
import { queueLine, REDEMPTION_EXPLAINER } from "@/lib/leverage/copy";
import type { QueuePosition } from "@/lib/leverage/queue";
import type { PageNotice } from "@/lib/leverage/view";
import { useNetwork } from "@/lib/config/network-context";

// Presentational pieces of the Trove pages: no wallet hooks except the network, so they render in tests.

/** The redemption-queue figure, before → after; hidden when the queue read failed. */
export function QueueLine({ before, after }: { before: QueuePosition | null; after: QueuePosition | null }) {
  if (!before && !after) return null;
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">
        <Term id="redemption">Redemption</Term> queue
      </p>
      {before && <p className="text-muted">Now: {queueLine(before)}</p>}
      {after && <p>After: {queueLine(after)}</p>}
      <p className="text-xs leading-relaxed text-muted">{REDEMPTION_EXPLAINER}</p>
    </div>
  );
}

/** Target collateral ratio: presets plus a field (percent). */
export function CrField({
  value,
  onChange,
  presets,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  presets: bigint[];
  label: string;
}) {
  const options = presets.map((p) => ({ value: formatPercent(p, 0).replace("%", ""), label: formatPercent(p, 0) }));
  return (
    <div className="space-y-2">
      <label htmlFor="target-cr" className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-inset border border-line px-4 py-2">
        <input
          id="target-cr"
          inputMode="decimal"
          autoComplete="off"
          placeholder="250"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-title font-semibold outline-none placeholder:text-muted/60"
        />
        <span className="text-sm text-muted">%</span>
      </div>
      {options.length > 0 && (
        <Segmented label={`${label} presets`} options={options} value={options.find((o) => o.value === value)?.value ?? ("" as string)} onChange={onChange} size="sm" />
      )}
    </div>
  );
}

/** The page's one notice (Recovery Mode with its way out, EVM-only, Close instead, the mainnet note). */
export function TroveNotice({ notice, onRepay }: { notice: PageNotice | null; onRepay?: () => void }) {
  const { network } = useNetwork();
  if (!notice) return null;
  const actions = notice.actions.map((action) =>
    action === "close-instead" ? (
      <ButtonLink key={action} href="/trove/close/" variant="secondary" size="md">
        Close instead
      </ButtonLink>
    ) : action === "open-app" ? (
      <ButtonLink key={action} href={network.mezoAppUrl} external variant="secondary" size="md">
        Open Mezo app
      </ButtonLink>
    ) : onRepay ? (
      <button key={action} type="button" onClick={onRepay} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
        Repay from wallet
      </button>
    ) : null,
  );
  return (
    <Notice tone={notice.tone} role="status" action={actions.length > 0 ? <div className="flex flex-wrap gap-2">{actions}</div> : undefined}>
      {notice.text}
    </Notice>
  );
}
