/**
 * `enter` (Ruling P15 and P19): the highest figure is Mezo mainnet V2, `cast estimate` 496,365 for the G1 round
 * trip's permit entry with `stake` false, at the block before tx 0x415b…1445 (6 Nov 2026); plus 5% is 521,184,
 * rounded up to 5,000. V1's mainnet entry estimated 479,120 (15 Oct 2026). Testnet is lower: S1 used 328,115 to
 * 433,422, and a permit entry estimated 411,686 to 424,887 (5 Nov 2026).
 */
export const ENTER_GAS = 525_000n;
/**
 * `enter` that also stakes the LP in the gauge (Ruling P15): the highest healthy estimate is mainnet's 682,215, the
 * G1 round trip's MUSD-permit entry with stake (tx 0x415b…1445, 6 Nov 2026, `cast estimate` at the block before),
 * the account's first stake in the gauge; plus 5% is 716,326, rounded up to 5,000. Testnet: highest gasUsed
 * 448,402, estimate 548,483 (5 Nov 2026). `gasUsed` is net of refunds, so it understates the limit a call needs,
 * and on Mezo a receipt's `gasUsed` is at least half the limit. The estimate plus 20% still wins when it is higher
 * (`gasLimit`).
 */
export const ENTER_STAKE_GAS = 720_000n;
/**
 * `enterFromBtc` (Ruling P15): max(highest gasUsed 383,737, highest healthy estimate 439,723) plus 5% is
 * 461,709, rounded up to 5,000. Figures: the Task 9 drive without a permit (5 Nov 2026, tx 0x5942…2b59,
 * estimate 439,723, used 383,737) and with a real BTC permit (tx 0x7fa6…e3ae, estimate 365,530, used 309,544);
 * the G1 smoke measured used 299,498 and estimate 355,484.
 */
export const ENTER_BTC_GAS = 465_000n;
/**
 * `enterFromBtc` that also stakes: the highest healthy estimate is mainnet's 511,863 (the G1 round trip's BTC-permit
 * entry, tx 0xeac5…3caa, 6 Nov 2026; 377,312 with `stake` false) plus 5%, 537,457, rounded up to 5,000. Testnet:
 * a real BTC permit with stake (tx 0xb924…fe75, 5 Nov 2026, estimates 484,076 and 497,277, used 398,691); without
 * a permit estimate 487,483, used 388,897; the G1 smoke used 402,945.
 */
export const ENTER_BTC_STAKE_GAS = 540_000n;
/**
 * What the gauge deposit adds to an entry: mainnet's first stake, the same permit entry estimated with `stake` on
 * and off at one block, 682,215 − 496,365 = 185,850 (6 Nov 2026), plus 5%, rounded up to 5,000. A later stake by
 * the same account added 134,551 (BTC entry) and testnet 139,009: the first deposit writes fresh gauge storage.
 */
export const STAKE_EXTRA_GAS = 200_000n;

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
export function entryGasUnits(input: {
  approve: boolean;
  smartAccount: boolean;
  borrow?: boolean;
  stake?: boolean;
  asset?: "musd" | "btc";
}): bigint {
  const calls = input.approve ? 2n : 1n;
  const enter = input.asset === "btc"
    ? input.stake
      ? ENTER_BTC_STAKE_GAS
      : ENTER_BTC_GAS
    : input.borrow
    ? BORROW_ENTER_GAS + (input.stake ? STAKE_EXTRA_GAS : 0n)
    : input.stake
      ? ENTER_STAKE_GAS
      : ENTER_GAS;
  const units = enter + (input.approve ? APPROVE_GAS : 0n);
  return input.smartAccount ? units + calls * RELAYED_CALL_GAS : units;
}

/**
 * `exit` (Ruling P15 and P19): Mezo mainnet's real exit, `cast estimate` 491,297 at the block before the 15 Oct
 * 2026 transaction, plus 5% is 515,862, rounded up to 5,000. Testnet is lower: 417,468 with an LP permit (tx
 * 0x05ae…dad0, 12 Oct 2026) and 350,049 with an approval (2 Oct).
 */
export const EXIT_GAS = 520_000n;

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
/**
 * `gauge.withdraw`: highest estimate 176,067 and highest used 166,286 (mainnet tx 0x0ce0…a657, 11 Nov 2026),
 * plus 5%, rounded up to 5,000. Earlier: testnet estimate 147,097 / used 137,316 (5 Nov), mainnet estimate
 * 141,867 (6 Nov); the old 155,000 sat below the 11 Nov use.
 */
export const GAUGE_WITHDRAW_GAS = 185_000n;
/** `gauge.getReward`: mainnet estimate 85,049 (tx 0x093b…bd59, 6 Nov 2026), plus 5%, rounded up to 5,000; testnet estimated 67,949 (highest used 66,295). */
export const GAUGE_CLAIM_GAS = 90_000n;

// L1 (MezoRouteLeverage), from the testnet smoke run of 7 Nov 2026 with hints (docs/STATUS.md):
// max(gasUsed, healthy eth_estimateGas) + 5%, rounded up to 5,000. Unwind used 645,994 (estimate
// 736,405), leverage 660,143 (754,742), close 541,508 (652,181), openLeveraged 754,502 (848,047).
export const UNWIND_GAS = 775_000n;
export const LEVERAGE_GAS = 795_000n;
export const CLOSE_GAS = 685_000n;
export const OPEN_LEVERAGED_GAS = 895_000n;

// Direct BorrowerOperations calls, from real mainnet transactions (explorer, 7 Nov 2026): refinance
// used 363,349, claimCollateral 129,811, repayMUSD 349,644; + 5%, rounded up to 5,000.
export const REFINANCE_GAS = 385_000n;
export const CLAIM_COLLATERAL_GAS = 140_000n;
export const REPAY_GAS = 370_000n;

/**
 * Mainnet has no L1 round trip to measure (user's decision, 7 Nov 2026), so its flash budgets are
 * testnet's × 1.3 (G1's mainnet-over-testnet gaps came from the first gauge stake, which these paths do not touch).
 */
export const MAINNET_LEVERAGE_GAS_FACTOR = 13n;

const TROVE_GAS = { unwind: UNWIND_GAS, close: CLOSE_GAS, leverage: LEVERAGE_GAS, open: OPEN_LEVERAGED_GAS } as const;

export function troveGasBudget(action: keyof typeof TROVE_GAS, network: { id: "testnet" | "mainnet" }): bigint {
  const base = TROVE_GAS[action];
  return network.id === "mainnet" ? (base * MAINNET_LEVERAGE_GAS_FACTOR) / 10n : base;
}
