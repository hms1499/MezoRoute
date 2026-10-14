import {
  ABOVE_HEADROOM,
  ALLOWANCE,
  AMOUNT_TOO_SMALL,
  CR_FLOOR,
  INSUFFICIENT_BALANCE,
  NO_SP_DEPOSIT,
  NO_TROVE,
  PERMIT_EXPIRED,
  PRICE_UNAVAILABLE,
  RECOVERY_MODE,
  SIGNATURE_INVALID,
  SP_WITHDRAW_BLOCKED,
} from "./outcomes";
import type { Outcome } from "./types";

/**
 * Known `Error(string)` reverts, matched against the decoded reason or, without revert data, the
 * error text. F5 added the Stability Pool rows.
 */
export const REVERT_STRINGS: readonly { match: RegExp; outcome: Outcome }[] = [
  { match: /ERC20: insufficient allowance/i, outcome: ALLOWANCE },
  { match: /ERC20: transfer amount exceeds balance/i, outcome: INSUFFICIENT_BALANCE },
  // MUSD PriceFeed.fetchPrice(): every Trove read and borrow needs a fresh price.
  { match: /PriceFeed: Oracle is stale/i, outcome: PRICE_UNAVAILABLE },
  // BorrowerOperationsSignatures and BorrowerOperations (Borrow & Deploy, F4).
  { match: /BorrowerOperationsSignatures: Invalid signature/i, outcome: SIGNATURE_INVALID },
  { match: /\bSignature expired\b/i, outcome: PERMIT_EXPIRED },
  // StabilityPool (F5): withdrawFromSP / provideToSP.
  { match: /Cannot withdraw while there are troves with ICR < MCR/i, outcome: SP_WITHDRAW_BLOCKED },
  { match: /User must have a non-zero deposit/i, outcome: NO_SP_DEPOSIT },
  { match: /StabilityPool: Amount must be non-zero/i, outcome: AMOUNT_TOO_SMALL },
  { match: /would result in ICR < MCR/i, outcome: CR_FLOOR },
  { match: /exceeds maxBorrowingCapacity/i, outcome: ABOVE_HEADROOM },
  { match: /TCR < CCR|in Recovery Mode/i, outcome: RECOVERY_MODE },
  { match: /Trove does not exist or is closed/i, outcome: NO_TROVE },
];

export function revertStringOutcome(text: string): Outcome | null {
  return REVERT_STRINGS.find((row) => row.match.test(text))?.outcome ?? null;
}
