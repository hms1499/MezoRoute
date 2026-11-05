export type ExitCopy = { exitDetail: string; unstakeNote: string | null };

/** Step and card copy for an exit that must first take `unstake` LP out of the gauge. */
export function exitCopy(unstake: bigint): ExitCopy {
  if (unstake === 0n) {
    return {
      exitDetail: "One transaction: remove liquidity and sell the BTC half for MUSD. No MezoRoute fee.",
      unstakeNote: null,
    };
  }
  return {
    exitDetail: "Remove liquidity and sell the BTC half for MUSD. No MezoRoute fee.",
    unstakeNote:
      "Part of this LP is staked, so the exit takes two transactions: unstake, then exit. Your pending MEZO stays claimable. While staked, swap fees go to veBTC voters.",
  };
}
