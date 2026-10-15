import { LP_RISKS } from "@/lib/routes/copy";

const BORROW_RISK = "Using borrowed MUSD does not reduce your debt, and an LP deposit adds BTC exposure.";

export function RisksCard({ borrow = false }: { borrow?: boolean }) {
  const risks = borrow ? [BORROW_RISK, ...LP_RISKS] : LP_RISKS;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Risks</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {risks.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
    </section>
  );
}
