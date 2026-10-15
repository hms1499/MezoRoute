import { ChevronDown, TriangleAlert } from "lucide-react";

/** The main risk in one sentence, the rest behind "More risks" (§9: one sentence before detail). */
export function RiskList({ risks }: { risks: string[] }) {
  const [first, ...more] = risks;
  return (
    <div className="text-sm">
      <p className="flex gap-2 text-muted">
        <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" />
        <span>{first}</span>
      </p>
      {more.length > 0 && (
        <details className="group mt-1">
          <summary className="inline-flex min-h-9 items-center gap-1 rounded-full font-medium text-accent">
            More risks
            <ChevronDown aria-hidden className="h-4 w-4 transition-transform duration-150 group-open:rotate-180" />
          </summary>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
            {more.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
