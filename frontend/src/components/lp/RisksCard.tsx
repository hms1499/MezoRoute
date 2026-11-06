import { Card } from "@/components/ui/Card";
import { entryRisks } from "@/lib/flow/risks";

export function RisksCard({ borrow = false, fromBtc = false }: { borrow?: boolean; fromBtc?: boolean }) {
  return (
    <Card level="section" title="Risks">
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
        {entryRisks({ borrow, fromBtc }).map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
    </Card>
  );
}
