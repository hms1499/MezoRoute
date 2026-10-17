import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Term } from "@/components/ui/Term";
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
    <Card
      title={
        <>
          Your <Term id="trove">Trove</Term> after this borrow
        </>
      }
    >
      <dl className="mt-3 stat-list">
        <Stat label="Debt" sub={`includes the ${musd(effect.fee)} borrowing fee`}>
          {musd(trove.debt)} → {musd(effect.newDebt)}
        </Stat>
        <Stat
          label={<Term id="collateralRatio">Collateral ratio</Term>}
          sub={
            <>
              <Term id="mcr">minimum {percent(mcr)}</Term>, <Term id="safetyFloor">MezoRoute floor {percent(CR_SAFETY_FLOOR)}</Term>
            </>
          }
          strong
        >
          {percent(cr)} → {percent(effect.newCr)}
        </Stat>
      </dl>
    </Card>
  );
}
