import type { OverviewRow } from "@/components/flow/Overview";
import { Term } from "@/components/ui/Term";
import type { Trove } from "@/lib/dashboard/snapshot";
import { formatPercent } from "@/lib/format";
import type { BorrowEffect } from "@/lib/trove/borrow";
import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";
import { collateralRatio } from "@/lib/trove/health";
import { musdShort } from "./units";

/** The Trove before → after the borrow (Flow D step 2), as rows of the action card's overview (U11 §6.1). */
export function troveChangeRows({ trove, effect, price, mcr }: { trove: Trove; effect: BorrowEffect; price: bigint; mcr: bigint }): OverviewRow[] {
  const cr = collateralRatio(trove, price);
  const percent = (value: bigint | null) => (value === null ? "—" : formatPercent(value, 1));
  return [
    {
      label: (
        <>
          <Term id="trove">Trove</Term> debt
        </>
      ),
      value: `${musdShort(trove.debt)} → ${musdShort(effect.newDebt)}`,
      sub: `includes the ${musdShort(effect.fee)} borrowing fee`,
    },
    {
      label: <Term id="collateralRatio">Collateral ratio</Term>,
      value: `${percent(cr)} → ${percent(effect.newCr)}`,
      sub: (
        <>
          <Term id="mcr">minimum {percent(mcr)}</Term>, <Term id="safetyFloor">MezoRoute floor {percent(CR_SAFETY_FLOOR)}</Term>
        </>
      ),
    },
  ];
}
