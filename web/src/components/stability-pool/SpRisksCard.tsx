import { SP_RISKS } from "@/lib/routes/copy";

export function SpRisksCard() {
  return (
    <section className="card">
      <h2 className="font-semibold">Risks</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {SP_RISKS.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
    </section>
  );
}
