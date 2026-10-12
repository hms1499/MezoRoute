/** Gas units for `enter`; S1 measured 328,115–433,422 (5 Oct 2026). */
export const ENTER_GAS = 450_000n;
/** An ERC-20 approval. */
export const APPROVE_GAS = 60_000n;
/** OrangeKit's relayer adds the Safe's baseGas (0x3035F) to the refund of each relayed call. */
export const RELAYED_CALL_GAS = 197_471n;

/** Estimated gas units for the whole entry flow, for the preview's network-fee line. */
export function entryGasUnits(input: { approve: boolean; smartAccount: boolean }): bigint {
  const calls = input.approve ? 2n : 1n;
  const units = ENTER_GAS + (input.approve ? APPROVE_GAS : 0n);
  return input.smartAccount ? units + calls * RELAYED_CALL_GAS : units;
}
