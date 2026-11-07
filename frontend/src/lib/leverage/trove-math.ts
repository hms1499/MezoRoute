import { ceilDiv, WAD } from "@/lib/math";

/** A Trove as the leverage pages read it (pending redistribution folded in, as getEntireDebtAndColl does). */
export type TroveState = {
  coll: bigint; // BTC
  principal: bigint; // MUSD, gas compensation included
  interest: bigint; // MUSD accrued
  debt: bigint; // principal + interest
  maxBorrowingCapacity: bigint; // MUSD
  interestRateBps: bigint; // TroveManager.getTroveInterestRate
};
export type PoolState = { reserveMusd: bigint; reserveBtc: bigint; feeBps: bigint };
export type Market = { price: bigint; borrowingRate: bigint; mcr: bigint };

/** Positive `debtDelta` borrows (principal += delta + fee); negative repays, interest first (MUSD's order). */
export function troveAfter(t: TroveState, change: { collDelta: bigint; debtDelta: bigint; feeOnIncrease: bigint }): TroveState {
  let { principal, interest } = t;
  if (change.debtDelta >= 0n) {
    principal += change.debtDelta + change.feeOnIncrease;
  } else {
    const repay = -change.debtDelta;
    const fromInterest = repay < interest ? repay : interest;
    interest -= fromInterest;
    principal -= repay - fromInterest;
  }
  return { ...t, coll: t.coll + change.collDelta, principal, interest, debt: principal + interest };
}

export function cr(t: TroveState, price: bigint): bigint | null {
  return t.debt === 0n ? null : (t.coll * price) / t.debt;
}

/** TroveManager.getNominalICR: coll × 1e20 / principal; SortedTroves (and redemptions) order by it. */
export function nominalCr(t: TroveState): bigint {
  return t.principal === 0n ? 0n : (t.coll * 10n ** 20n) / t.principal;
}

/** The BTC price at which CR reaches the MCR, rounded up (never flatters the Trove). */
export function liquidationPriceOf(t: TroveState, mcr: bigint): bigint | null {
  return t.coll === 0n ? null : ceilDiv(t.debt * mcr, t.coll);
}

export const borrowingFee = (amount: bigint, borrowingRate: bigint) => (amount * borrowingRate) / WAD;
