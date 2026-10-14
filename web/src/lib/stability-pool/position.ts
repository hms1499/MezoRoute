import { WAD } from "@/lib/math";
import type { SpCostBasis } from "./cost-basis";
import type { SpSnapshot } from "./snapshot";

export type SpCostView = {
  basis: bigint;
  valueChange: bigint; // value now − basis: "Estimated position value change", never "profit"
  gainsClaimed: bigint; // BTC already paid to the wallet since this position started
  absorbed: bigint; // MUSD this position gave up to liquidations: realised at past actions + pending now
};
export type SpView = { deposit: bigint; gain: bigint; gainValue: bigint; value: bigint; empty: boolean; cost: SpCostView | null };

/** The Stability Pool card (spec Flow F) from one snapshot and, once loaded, the cost basis. */
export function spView(snapshot: SpSnapshot, basis: SpCostBasis | null): SpView {
  const { deposit, btcGain: gain } = snapshot.dashboard.sp;
  const gainValue = (gain * snapshot.dashboard.price) / WAD;
  const value = deposit + gainValue;
  const pendingLoss = snapshot.initialDeposit > deposit ? snapshot.initialDeposit - deposit : 0n;
  return {
    deposit,
    gain,
    gainValue,
    value,
    empty: snapshot.initialDeposit === 0n,
    cost: basis && {
      basis: basis.basis,
      valueChange: value - basis.basis,
      gainsClaimed: basis.gainsClaimed,
      absorbed: basis.lossRealised + pendingLoss,
    },
  };
}
