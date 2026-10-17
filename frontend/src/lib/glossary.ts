import { formatPercent } from "@/lib/format";
import { CR_SAFETY_FLOOR } from "@/lib/trove/constants";

export type TermId =
  | "trove"
  | "musd"
  | "stabilityPool"
  | "collateralRatio"
  | "mcr"
  | "safetyFloor"
  | "liquidationPrice"
  | "btcGain"
  | "borrowAndDeploy"
  | "permit";

/**
 * One sentence per Mezo term, shown by `Term` (U8). Readers know basic DeFi (LP, slippage, approvals),
 * so only Mezo and MezoRoute terms are here. The MCR is a protocol constant (110%), read on chain elsewhere.
 */
export const GLOSSARY: Record<TermId, string> = {
  trove: "Your MUSD loan on Mezo, backed by the BTC you lock in it.",
  musd: "Mezo's dollar stablecoin, minted when you borrow against BTC.",
  stabilityPool: "MUSD deposits that repay the debt of liquidated Troves; depositors receive those Troves' BTC.",
  collateralRatio: "Your Trove's BTC value divided by its debt.",
  mcr: "Below a 110% collateral ratio, the Trove can be liquidated.",
  safetyFloor: `MezoRoute only lets you borrow while your ratio stays at or above ${formatPercent(CR_SAFETY_FLOOR, 0)}, a buffer against a BTC drop.`,
  liquidationPrice: "The BTC price at which your collateral ratio falls to 110%.",
  btcGain: "BTC the Stability Pool paid you from liquidations; you can claim it any time.",
  borrowAndDeploy: "Borrow MUSD from your Trove and add it to the pool in one transaction.",
  permit: "A gasless signature that lets MezoRoute take exactly this amount, instead of an approval transaction.",
};
