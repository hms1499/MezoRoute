import { ALLOWANCE, INSUFFICIENT_BALANCE } from "./outcomes";
import type { Outcome } from "./types";

/**
 * Known `Error(string)` reverts, matched against the decoded reason or, without revert data, the
 * error text. F4 adds the BorrowerOperationsSignatures rows and F5 the Stability Pool rows.
 */
export const REVERT_STRINGS: readonly { match: RegExp; outcome: Outcome }[] = [
  { match: /ERC20: insufficient allowance/i, outcome: ALLOWANCE },
  { match: /ERC20: transfer amount exceeds balance/i, outcome: INSUFFICIENT_BALANCE },
];

export function revertStringOutcome(text: string): Outcome | null {
  return REVERT_STRINGS.find((row) => row.match.test(text))?.outcome ?? null;
}
