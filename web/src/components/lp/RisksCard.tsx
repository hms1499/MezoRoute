import { Card } from "@/components/ui/Card";
import { LP_RISKS } from "@/lib/routes/copy";

const BORROW_RISK = "Using borrowed MUSD does not reduce your debt, and an LP deposit adds BTC exposure.";

export function RisksCard({ borrow = false }: { borrow?: boolean }) {
  const risks = borrow ? [BORROW_RISK, ...LP_RISKS] : LP_RISKS;
  return (
    <Card title="Risks">
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
        {risks.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
    </Card>
  );
}
