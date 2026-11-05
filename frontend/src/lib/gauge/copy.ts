import { formatToken } from "@/lib/format";
import type { StakeAvailability } from "./availability";

export const STAKE_TITLE = "Stake to earn MEZO";

const FEES_NOTE = "While staked, swap fees go to veBTC voters instead of you.";
const NO_AMOUNT = "Enter an amount to see this week's rate.";
const BETWEEN_WEEKS = "The new week's MEZO rate is not set yet. Staking still works.";

// A failed gauge read is not a missing gauge: the LP may be staked, so nothing here may say there is none.
export const GAUGE_READ_FAILED_POSITIONS = "Staked LP and pending MEZO could not be read right now, so they are not shown here. LP in your wallet can still exit.";
export const GAUGE_READ_FAILED_EXPOSURE = "Staked LP could not be read right now, so this may leave it out.";
export const GAUGE_READ_FAILED_ENTRY = "The gauge could not be read right now, so this deposit will not be staked. You can stake it later from Positions.";
export const GAUGE_READ_FAILED_EXIT = "Staked LP could not be read right now, so this exit covers only the LP in your wallet.";
export const GAUGE_READ_FAILED_RETRY = "Staked LP could not be read right now. Try again in a moment.";
export const GAUGE_READ_FAILED_SUMMARY = "In your wallet only: staked LP could not be read";

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
