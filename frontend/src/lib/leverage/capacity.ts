import { WAD } from "@/lib/math";
import { GAS_COMPENSATION } from "@/lib/trove/constants";
import { borrowingFee, type TroveState } from "./trove-math";

/** BorrowerOperations._calculateMaxBorrowingCapacity: coll × price / 110%, set at open and at refinance only. */
export function capacityAfterRefinance(t: TroveState, price: bigint): bigint {
  return (t.coll * price) / ((110n * WAD) / 100n);
}

/** BorrowerOperations._refinance: the borrowing fee on 20% of the net debt. */
export function refinanceFee(t: TroveState, borrowingRate: bigint): bigint {
  return borrowingFee(((t.debt - GAS_COMPENSATION) * 20n) / 100n, borrowingRate);
}

export type CapacityCheck = "ok" | "refinance" | "blocked";

/**
 * Whether a debt increase fits the Trove's borrowing capacity (`debt + increase + fee ≤ capacity`):
 * "ok" as it stands; "refinance" when only a refinance first (which resets capacity from today's
 * collateral and adds its own fee) makes room; "blocked" otherwise. Added collateral never raises it.
 */
export function capacityCheck(t: TroveState, price: bigint, debtIncrease: bigint, borrowingRate: bigint): CapacityCheck {
  const need = t.debt + debtIncrease + borrowingFee(debtIncrease, borrowingRate);
  if (need <= t.maxBorrowingCapacity) return "ok";
  return need + refinanceFee(t, borrowingRate) <= capacityAfterRefinance(t, price) ? "refinance" : "blocked";
}

export type LeverageStepKind = "refinance" | "authorise" | "permit" | "send";

export function leverageSteps(capacity: CapacityCheck): LeverageStepKind[] {
  return capacity === "refinance" ? ["refinance", "authorise", "permit", "send"] : ["authorise", "permit", "send"];
}
