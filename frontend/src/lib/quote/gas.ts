/** Gas units for `enter`; S1 measured 328,115–433,422 (5 Oct 2026). */
export const ENTER_GAS = 450_000n;
/**
 * `enter` that also stakes the LP in the gauge. `gasUsed` is net of refunds, so it understates the limit a
 * call needs (Ruling P15): the budget is max(highest gasUsed 448,402, highest healthy estimate 535,750)
 * plus 5%, rounded up to 5,000. The estimate plus 20% still wins when it is higher (`gasLimit`).
 */
export const ENTER_STAKE_GAS = 565_000n;
/** What the gauge deposit adds to an entry: estimate difference 535,750 − 396,741 = 139,009, plus 5%, rounded up to 5,000. */
export const STAKE_EXTRA_GAS = 150_000n;

/**
 * `borrowAndEnter` with Trove hints: 754,103 measured on testnet (12 Oct 2026, 242 Troves), rounded
 * up to 800,000 plus 10%. Without hints SortedTroves walks the list: 2,178,863 (2 Oct 2026).
 */
export const BORROW_ENTER_GAS = 880_000n;
/** `borrowAndEnter` with zero hints: 2,178,863 measured (2 Oct 2026), rounded up to 2,200,000 plus 10%. */
export const BORROW_ENTER_NO_HINTS_GAS = 2_420_000n;

export function borrowEnterGas(hintsFound: boolean, stake = false): bigint {
  return (hintsFound ? BORROW_ENTER_GAS : BORROW_ENTER_NO_HINTS_GAS) + (stake ? STAKE_EXTRA_GAS : 0n);
}
/** An ERC-20 approval. */
export const APPROVE_GAS = 60_000n;
/** OrangeKit's relayer adds the Safe's baseGas (0x3035F) to the refund of each relayed call. */
export const RELAYED_CALL_GAS = 197_471n;

/** Estimated gas units for the whole entry flow, for the preview's network-fee line. */
export function entryGasUnits(input: { approve: boolean; smartAccount: boolean; borrow?: boolean; stake?: boolean }): bigint {
  const calls = input.approve ? 2n : 1n;
  const enter = input.borrow
    ? BORROW_ENTER_GAS + (input.stake ? STAKE_EXTRA_GAS : 0n)
    : input.stake
      ? ENTER_STAKE_GAS
      : ENTER_GAS;
  const units = enter + (input.approve ? APPROVE_GAS : 0n);
  return input.smartAccount ? units + calls * RELAYED_CALL_GAS : units;
}

/**
 * `exit`: 417,468 measured on testnet with an LP permit (tx 0x05ae…dad0, 12 Oct 2026; 350,049 with an
 * approval on 2 Oct), rounded up to 450,000 plus 10%.
 */
export const EXIT_GAS = 495_000n;

/** Estimated gas units for the whole exit flow, for the preview's network-fee line. */
export function exitGasUnits(input: { approve: boolean; smartAccount: boolean; unstake?: boolean }): bigint {
  const calls = 1n + (input.approve ? 1n : 0n) + (input.unstake ? 1n : 0n);
  const units = EXIT_GAS + (input.approve ? APPROVE_GAS : 0n) + (input.unstake ? GAUGE_WITHDRAW_GAS : 0n);
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
 * `withdrawFromSP` (14 Oct 2026 estimates): 225,416 when it pays a BTC gain, 146,084–151,240 without
 * one (the Trove-ICR check reads the price feed), 53,399 for a zero-amount claim. 280,000 is the
 * gain-paying case plus 20%, rounded up. Mezo charges at least half the limit (see `gasLimit`), so a plain
 * withdrawal costs about 140,000, close to its real use.
 */
export const SP_WITHDRAW_GAS = 280_000n;
/**
 * `provideToSP`: 86,499 estimated for a top-up without a BTC gain; paying a gain adds about 79,000
 * (the withdrawal difference above), so 220,000 is that sum plus 20%.
 */
export const SP_DEPOSIT_GAS = 220_000n;

/** Estimated gas units for a Stability Pool action, for the preview's network-fee line. */
export function spGasUnits(input: { approve: boolean; smartAccount: boolean; action: "deposit" | "withdraw" }): bigint {
  const calls = input.approve ? 2n : 1n;
  const units = (input.action === "deposit" ? SP_DEPOSIT_GAS : SP_WITHDRAW_GAS) + (input.approve ? APPROVE_GAS : 0n);
  return input.smartAccount ? units + calls * RELAYED_CALL_GAS : units;
}

/**
 * Direct gauge calls. Each budget is max(highest `gasUsed`, highest healthy `eth_estimateGas`) + 5%, rounded
 * up to 5,000 (Ruling P15): `gasUsed` is net of refunds, and a deposit that used about 140,000 ran out of gas
 * at a 145,000 limit (5 Nov 2026). It is the floor that protects a send when the RPC answers
 * `eth_estimateGas` with the bare intrinsic gas.
 */
/** `gauge.deposit`: estimate 154,522 (highest used 142,295). */
export const GAUGE_DEPOSIT_GAS = 165_000n;
/** `gauge.withdraw`: highest estimate 147,097 (an exit's unstake, 5 Nov 2026; highest used 137,316), plus 5%, rounded up to 5,000. */
export const GAUGE_WITHDRAW_GAS = 155_000n;
/** `gauge.getReward`: estimate 67,949 (highest used 66,295). */
export const GAUGE_CLAIM_GAS = 75_000n;
