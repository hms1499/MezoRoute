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

/** Under the pool-fees card when every LP token is staked: fees are not missing, they go to veBTC voters. */
export function feesStakedNote(input: { walletLp: bigint; stakedLp: bigint; fees: { musd: bigint; btc: bigint } }): string | null {
  const { walletLp, stakedLp, fees } = input;
  if (walletLp > 0n || stakedLp === 0n || fees.musd > 0n || fees.btc > 0n) return null;
  return "Your LP is all staked, so it earns no pool fees: swap fees go to veBTC voters.";
}
