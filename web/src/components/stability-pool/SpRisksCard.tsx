const RISKS = [
  "Your deposit shrinks when the pool absorbs liquidated debt; you receive that Trove's BTC instead, usually worth more than the debt.",
  "Withdrawals pause while any Trove is under-collateralised. Claiming your BTC gain is never paused.",
  "BTC gains arrive only when liquidations happen, and their value moves with the BTC price.",
];

export function SpRisksCard() {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Risks</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {RISKS.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
    </section>
  );
}
