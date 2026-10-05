import type { Protocol, Trove } from "@/lib/dashboard/snapshot";
import { ceilDiv, WAD } from "@/lib/math";
import { AT_RISK_DROP_PERCENT, CR_SAFETY_FLOOR } from "./constants";

export type TroveHealth = "healthy" | "at-risk" | "liquidatable";

/** Collateral value over debt (1e18 = 100%), rounded down; null when there is no debt. */
export function collateralRatio(trove: Trove, price: bigint): bigint | null {
  if (trove.debt === 0n) return null;
  return (trove.collateral * price) / trove.debt;
}

/** The BTC price at which the Trove reaches the MCR, rounded up; null without collateral. */
export function liquidationPrice(trove: Trove, mcr: bigint): bigint | null {
  if (trove.collateral === 0n) return null;
  return ceilDiv(trove.debt * mcr, trove.collateral);
}

export function troveHealth(cr: bigint | null, mcr: bigint): TroveHealth {
  if (cr === null) return "healthy";
  if (cr < mcr) return "liquidatable";
  if ((cr * BigInt(100 - AT_RISK_DROP_PERCENT)) / 100n < mcr) return "at-risk";
  return "healthy";
}

/**
 * The most MUSD the Trove can still borrow, rounded down. BorrowerOperations caps debt at the Trove's
 * `maxBorrowingCapacity`, and MezoRoute keeps the collateral ratio at or above the safety floor; the
 * borrowing fee is added to the debt, so the gap is divided by (1 + fee).
 */
export function borrowHeadroom(trove: Trove, price: bigint, protocol: Protocol): bigint {
  const byFloor = (trove.collateral * price) / CR_SAFETY_FLOOR;
  const limit = byFloor < trove.maxBorrowingCapacity ? byFloor : trove.maxBorrowingCapacity;
  if (limit <= trove.debt) return 0n;
  return ((limit - trove.debt) * WAD) / (WAD + protocol.borrowingRate);
}
