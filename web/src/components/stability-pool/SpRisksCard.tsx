import { Card } from "@/components/ui/Card";
import { SP_RISKS } from "@/lib/routes/copy";

export function SpRisksCard() {
  return (
    <Card title="Risks">
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
        {SP_RISKS.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
    </Card>
  );
}
