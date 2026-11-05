import type { ExitStepKind } from "./exit-steps";

export type ExitCopy = { exitDetail: string; unstakeNote: string | null };

/**
 * Step and card copy for the planned exit. The plan already reflects the wallet kind and the allowance: a standard
 * wallet signs a permit (no transaction), and a Bitcoin wallet with a short allowance approves in a transaction of its own.
 */
export function exitCopy(steps: readonly ExitStepKind[]): ExitCopy {
  if (!steps.includes("unstake")) {
    return {
      exitDetail: "One transaction: remove liquidity and sell the BTC half for MUSD. No MezoRoute fee.",
      unstakeNote: null,
    };
  }
  const sequence = steps.includes("approve") ? "three transactions: unstake, approve, then exit" : "two transactions: unstake, then exit";
  return {
    exitDetail: "Remove liquidity and sell the BTC half for MUSD. No MezoRoute fee.",
    unstakeNote: `Part of this LP is staked, so the exit takes ${sequence}. Your pending MEZO stays claimable. While staked, swap fees go to veBTC voters.`,
  };
}
