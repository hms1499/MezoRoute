import { StatRow } from "@/components/dashboard/StatRow";
import type { Trove } from "@/lib/dashboard/snapshot";
import { formatPercent } from "@/lib/format";
import type { BorrowEffect } from "@/lib/trove/borrow";
import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";
import { collateralRatio } from "@/lib/trove/health";
import { musd } from "./units";

/** The Trove before → after the borrow (Flow D step 2). */
export function TroveChangeCard({ trove, effect, price, mcr }: { trove: Trove; effect: BorrowEffect; price: bigint; mcr: bigint }) {
  const cr = collateralRatio(trove, price);
  const percent = (value: bigint | null) => (value === null ? "—" : formatPercent(value, 1));
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Your Trove after this borrow</h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <StatRow label="Debt" sub={`includes the ${musd(effect.fee)} borrowing fee`}>
          {musd(trove.debt)} → {musd(effect.newDebt)}
        </StatRow>
        <StatRow label="Collateral ratio" sub={`minimum ${percent(mcr)}, MezoRoute floor ${percent(CR_SAFETY_FLOOR)}`} strong>
          {percent(cr)} → {percent(effect.newCr)}
        </StatRow>
      </dl>
    </section>
  );
}
