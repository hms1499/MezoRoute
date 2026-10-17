import type { Protocol, Trove } from "@/lib/dashboard/snapshot";
import { WAD } from "@/lib/math";
import { borrowHeadroom, collateralRatio } from "./health";

/** LiquityMath.NICR_PRECISION: the nominal ICR that orders SortedTroves. */
export const NICR_PRECISION = 10n ** 20n;

/** System totals read with the LP route snapshot; recovery mode and hint trials come from them. */
export type SystemState = { coll: bigint; debt: bigint; ccr: bigint; troveCount: bigint };

export type BorrowEffect = {
  amount: bigint;
  fee: bigint; // borrowing fee, minted to the PCV and added to the debt
  newPrincipal: bigint;
  newDebt: bigint;
  newCr: bigint | null; // 1e18 = 100%
  newNicr: bigint; // collateral × 1e20 / principal, as TroveManager.getNominalICR
};

/**
 * What borrowing `amount` does to the Trove, with BorrowerOperations' rounding: the fee is
 * amount × borrowingRate / 1e18 rounded down, and debt and principal both grow by amount + fee.
 */
export function borrowEffect(trove: Trove, price: bigint, protocol: Protocol, amount: bigint): BorrowEffect {
  const fee = (amount * protocol.borrowingRate) / WAD;
  const newPrincipal = trove.principal + amount + fee;
  const newDebt = trove.debt + amount + fee;
  return {
    amount,
    fee,
    newPrincipal,
    newDebt,
    newCr: collateralRatio({ ...trove, debt: newDebt }, price),
    newNicr: (trove.collateral * NICR_PRECISION) / newPrincipal,
  };
}

/** The most the user may borrow and deploy: the safe headroom, capped by the executor's entry cap. */
export function borrowLimit(trove: Trove | null, price: bigint, protocol: Protocol, maxMusdIn: bigint): bigint {
  if (!trove) return 0n;
  const headroom = borrowHeadroom(trove, price, protocol);
  return headroom < maxMusdIn ? headroom : maxMusdIn;
}

/** TroveManager.checkRecoveryMode, computed locally: TCR = system collateral × price / system debt < CCR. */
export function isRecoveryMode(system: SystemState, price: bigint): boolean {
  if (system.debt === 0n) return false;
  return (system.coll * price) / system.debt < system.ccr;
}
