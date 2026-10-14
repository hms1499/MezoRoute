/** Gas units for `enter`; S1 measured 328,115–433,422 (5 Oct 2026). */
export const ENTER_GAS = 450_000n;

/**
 * `borrowAndEnter` with Trove hints: 754,103 measured on testnet (12 Oct 2026, 242 Troves), rounded
 * up to 800,000 plus 10%. Without hints SortedTroves walks the list: 2,178,863 (2 Oct 2026).
 */
export const BORROW_ENTER_GAS = 880_000n;
/** `borrowAndEnter` with zero hints: 2,178,863 measured (2 Oct 2026), rounded up to 2,200,000 plus 10%. */
export const BORROW_ENTER_NO_HINTS_GAS = 2_420_000n;

export function borrowEnterGas(hintsFound: boolean): bigint {
  return hintsFound ? BORROW_ENTER_GAS : BORROW_ENTER_NO_HINTS_GAS;
}
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

/** `Pool.claimFees()`: 62,555–69,259 measured on testnet (12 Oct 2026), rounded up to 100,000 plus 10%. */
export const CLAIM_GAS = 110_000n;

/**
 * The gas limit an EVM wallet is given: the RPC estimate plus 20%, but never below the measured budget.
 * A Mezo testnet RPC backend answered eth_estimateGas with the bare intrinsic gas (12 Oct 2026); a
 * wallet adding its margin to that could send a transaction that runs out of gas on chain. Mezo
 * charges at least half of the gas limit (a provideToSP with a 330,000 limit used 165,000 exactly, tx
 * 0x8e3e…e3e7, 14 Oct 2026), so a budget should stay close to the measured use.
 */
export function gasLimit(budget: bigint, estimate: bigint | undefined): bigint {
  const padded = estimate === undefined ? 0n : (estimate * 12n) / 10n;
  return padded > budget ? padded : budget;
}

/**
 * `provideToSP`: 86,499 estimated for a top-up without a BTC gain (14 Oct 2026); a first deposit and
 * a BTC-gain payout cost more, so 180,000. Mezo charges at least half the limit (see `gasLimit`).
 */
export const SP_DEPOSIT_GAS = 180_000n;
/**
 * `withdrawFromSP`: 146,084–151,240 estimated without a BTC gain (14 Oct 2026; the Trove-ICR check
 * reads the price feed), 53,399 for a zero-amount claim; 200,000 leaves room for a BTC-gain payout.
 */
export const SP_WITHDRAW_GAS = 200_000n;

/** Estimated gas units for a Stability Pool action, for the preview's network-fee line. */
export function spGasUnits(input: { approve: boolean; smartAccount: boolean; action: "deposit" | "withdraw" }): bigint {
  const calls = input.approve ? 2n : 1n;
  const units = (input.action === "deposit" ? SP_DEPOSIT_GAS : SP_WITHDRAW_GAS) + (input.approve ? APPROVE_GAS : 0n);
  return input.smartAccount ? units + calls * RELAYED_CALL_GAS : units;
}
