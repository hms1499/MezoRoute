/** Gas units for `enter`; S1 measured 328,115–433,422 (5 Oct 2026). */
export const ENTER_GAS = 450_000n;

/**
 * `borrowAndEnter` with Trove hints: 754,103 measured on testnet (12 Oct 2026, 242 Troves), rounded
 * up to 800,000 plus 10%. Without hints SortedTroves walks the list: 2,178,863 (2 Oct 2026).
 */
export const BORROW_ENTER_GAS = 880_000n;
/** An ERC-20 approval. */
export const APPROVE_GAS = 60_000n;
/** OrangeKit's relayer adds the Safe's baseGas (0x3035F) to the refund of each relayed call. */
export const RELAYED_CALL_GAS = 197_471n;

/** Estimated gas units for the whole entry flow, for the preview's network-fee line. */
export function entryGasUnits(input: { approve: boolean; smartAccount: boolean; borrow?: boolean }): bigint {
  const calls = input.approve ? 2n : 1n;
  const units = (input.borrow ? BORROW_ENTER_GAS : ENTER_GAS) + (input.approve ? APPROVE_GAS : 0n);
  return input.smartAccount ? units + calls * RELAYED_CALL_GAS : units;
}

/**
 * `exit`: 417,468 measured on testnet with an LP permit (tx 0x05ae…dad0, 12 Oct 2026; 350,049 with an
 * approval on 2 Oct), rounded up to 450,000 plus 10%.
 */
export const EXIT_GAS = 495_000n;

/** Estimated gas units for the whole exit flow, for the preview's network-fee line. */
export function exitGasUnits(input: { approve: boolean; smartAccount: boolean }): bigint {
  const calls = input.approve ? 2n : 1n;
  const units = EXIT_GAS + (input.approve ? APPROVE_GAS : 0n);
  return input.smartAccount ? units + calls * RELAYED_CALL_GAS : units;
}
