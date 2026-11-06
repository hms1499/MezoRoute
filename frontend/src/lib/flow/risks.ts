// U11 §6.2: the full risk lists of each entry, shared by the amount page's Details and the Confirm page (where they
// are always visible before signing).

import { LP_BTC_RISKS, LP_RISKS } from "@/lib/routes/copy";

export const BORROW_RISK = "Using borrowed MUSD does not reduce your debt, and an LP deposit adds BTC exposure.";

export function entryRisks(input: { borrow: boolean; fromBtc: boolean }): string[] {
  if (input.borrow) return [BORROW_RISK, ...LP_RISKS];
  return input.fromBtc ? [...LP_BTC_RISKS] : [...LP_RISKS];
}
