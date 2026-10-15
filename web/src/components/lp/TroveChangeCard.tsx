import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
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
    <Card title="Your Trove after this borrow">
      <dl className="mt-3 stat-list">
        <Stat label="Debt" sub={`includes the ${musd(effect.fee)} borrowing fee`}>
          {musd(trove.debt)} → {musd(effect.newDebt)}
        </Stat>
        <Stat label="Collateral ratio" sub={`minimum ${percent(mcr)}, MezoRoute floor ${percent(CR_SAFETY_FLOOR)}`} strong>
          {percent(cr)} → {percent(effect.newCr)}
        </Stat>
      </dl>
    </Card>
  );
}
