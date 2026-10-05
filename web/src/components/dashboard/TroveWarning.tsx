import type { TroveWarning as Warning } from "@/lib/dashboard/readiness";

/** Persistent while the Trove is unhealthy; it never blocks using wallet MUSD (Flow A). */
export function TroveWarning({ warning }: { warning: Warning }) {
  const tone = warning.tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-bg text-warning-ink";
  return (
    <div role="alert" className={`flex flex-wrap items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ${tone}`}>
      <span className="min-w-0 flex-1">{warning.message}</span>
      <a
        href="#exposure"
        className="shrink-0 rounded-full border border-current bg-white px-3 py-1.5 text-xs font-semibold"
      >
        Review exposure
      </a>
    </div>
  );
}
