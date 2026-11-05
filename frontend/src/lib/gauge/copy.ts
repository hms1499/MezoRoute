import { formatToken } from "@/lib/format";
import type { StakeAvailability } from "./availability";

export const STAKE_TITLE = "Stake to earn MEZO";

const FEES_NOTE = "While staked, swap fees go to veBTC voters instead of you.";
const NO_AMOUNT = "Enter an amount to see this week's rate.";
const BETWEEN_WEEKS = "The new week's MEZO rate is not set yet. Staking still works.";

/** The lines under the stake switch. Rates are always "this week's"; swap fees to veBTC voters is always said. */
export function stakeLines(availability: StakeAvailability, mezoPerWeek: bigint | null): string[] {
  if (availability === "unavailable") return [];
  if (availability === "between-weeks") return [BETWEEN_WEEKS, FEES_NOTE];
  if (mezoPerWeek === null) return [`${NO_AMOUNT} ${FEES_NOTE}`];
  return [`≈ ${formatToken(mezoPerWeek, 18, 4)} MEZO a week at this week's rate. ${FEES_NOTE}`];
}
