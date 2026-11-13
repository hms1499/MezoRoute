import type { TroveState } from "@/lib/leverage/trove-math";
import { formatToken } from "@/lib/format";
import { ceilDiv, WAD } from "@/lib/math";
import { AT_RISK_DROP_PERCENT } from "./constants";

/**
 * U20: Liquity V2's two risk levels (`liquity/bold` frontend, `getLiquidationRisk` / `getRedemptionRisk`), on Mezo's
 * numbers. Display labels only: the at-risk warning (`troveHealth`) and the 160% floor do not change.
 */
export type LiquidationRisk = "low" | "medium" | "high" | "liquidatable";
export type RedemptionRisk = "low" | "medium" | "high";

// Liquity marks LTV above 54% of the max LTV medium and above 73% high; Mezo's max LTV is 1 / MCR.
const MEDIUM_LTV_SHARE = 54n;
const HIGH_LTV_SHARE = 73n;
// Liquity: over 60% of all debt ahead is low, over 5% medium, else high.
const REDEMPTION_LOW_SHARE = 60n;
const REDEMPTION_MEDIUM_SHARE = 5n;

/**
 * Liquidatable below the MCR. High starts at Liquity's line raised to the Dashboard's at-risk rule (a 30% drop reaches
 * the MCR), so "High" and the at-risk warning always agree; null without debt.
 */
export function liquidationRisk(cr: bigint | null, mcr: bigint): LiquidationRisk | null {
  if (cr === null) return null;
  if (cr < mcr) return "liquidatable";
  if ((cr * BigInt(100 - AT_RISK_DROP_PERCENT)) / 100n < mcr || cr * HIGH_LTV_SHARE < mcr * 100n) return "high";
  if (cr * MEDIUM_LTV_SHARE < mcr * 100n) return "medium";
  return "low";
}

/** The CR where High and Medium end (1e18 = 100%), rounded up: below `high` is High, below `medium` Medium. */
export function riskLines(mcr: bigint): { high: bigint; medium: bigint } {
  const liquity = ceilDiv(mcr * 100n, HIGH_LTV_SHARE);
  const atRisk = ceilDiv(mcr * 100n, BigInt(100 - AT_RISK_DROP_PERCENT));
  return { high: liquity > atRisk ? liquity : atRisk, medium: ceilDiv(mcr * 100n, MEDIUM_LTV_SHARE) };
}

/** The bands in words, whole percent rounded up: "Low from 204% · Medium 158–204% · High below 158%". */
export function riskLinesText(mcr: bigint): string {
  const { high, medium } = riskLines(mcr);
  const whole = (ratio: bigint) => formatToken(ratio * 100n, 18, 0, "up");
  return `Low from ${whole(medium)}% · Medium ${whole(high)}–${whole(medium)}% · High below ${whole(high)}%`;
}

/** By the share of all debt redemptions would reach before this Trove; null without any debt. */
export function redemptionRisk(debtAhead: bigint, total: bigint): RedemptionRisk | null {
  if (total === 0n) return null;
  if (debtAhead * 100n > total * REDEMPTION_LOW_SHARE) return "low";
  if (debtAhead * 100n > total * REDEMPTION_MEDIUM_SHARE) return "medium";
  return "high";
}

/** How far BTC has to fall to reach the liquidation price, in whole percent, rounded down (never flatters). */
export function liquidationDrop(liquidationPrice: bigint, price: bigint): number {
  if (price === 0n || liquidationPrice >= price) return 0;
  return Number(((price - liquidationPrice) * 100n) / price);
}

/** How much a year of interest raises the liquidation price (MUSD per BTC), rounded up; null when nothing accrues. */
export function interestDrift(trove: TroveState, mcr: bigint): bigint | null {
  if (trove.principal === 0n || trove.interestRateBps === 0n || trove.coll === 0n) return null;
  return ceilDiv(trove.principal * trove.interestRateBps * mcr, 10_000n * trove.coll);
}

/** Liquity's Multiply view: collateral minus debt, and the BTC exposure as a multiple of it (null when ≤ 0). */
export function multiplyView(trove: TroveState, price: bigint): { netValue: bigint; netBtc: bigint; leverage: bigint | null } {
  const collValue = (trove.coll * price) / WAD;
  const netValue = collValue - trove.debt;
  return {
    netValue,
    netBtc: price === 0n ? 0n : (netValue * WAD) / price,
    leverage: netValue > 0n ? (collValue * WAD) / netValue : null,
  };
}
