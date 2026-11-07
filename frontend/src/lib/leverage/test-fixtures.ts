import type { Market, PoolState, TroveState } from "./trove-math";

export const ONE = 10n ** 18n;

/** The contract tests' world (contracts/test/harness/LeverageHarness.sol): 1M MUSD / 10 BTC, 30 bps, oracle 100,000. */
export const HARNESS_POOL: PoolState = { reserveMusd: 1_000_000n * ONE, reserveBtc: 10n * ONE, feeBps: 30n };
export const HARNESS_MARKET: Market = { price: 100_000n * ONE, borrowingRate: ONE / 1000n, mcr: (11n * ONE) / 10n };

export function trove(coll: bigint, principal: bigint, interest = 0n, extra: Partial<TroveState> = {}): TroveState {
  return {
    coll,
    principal,
    interest,
    debt: principal + interest,
    maxBorrowingCapacity: (coll * HARNESS_MARKET.price) / ((11n * ONE) / 10n),
    interestRateBps: 500n,
    ...extra,
  };
}

/** Testnet, 7 Nov 2026 (cast reads): pool 102.5M MUSD / 1,304 BTC at 4 bps, oracle 75,816. */
export const TESTNET_POOL: PoolState = {
  reserveMusd: 102_508_838_208_363_834_410_753_493n,
  reserveBtc: 1_304_038_359_072_103_894_648n,
  feeBps: 4n,
};
export const TESTNET_MARKET: Market = { price: 75_816_471_860_000_000_000_000n, borrowingRate: ONE / 1000n, mcr: (11n * ONE) / 10n };

/** Mainnet, 7 Nov 2026: pool 37.1k MUSD / 0.483 BTC at 30 bps, oracle 75,816. */
export const MAINNET_POOL: PoolState = {
  reserveMusd: 37_134_306_055_131_145_747_483n,
  reserveBtc: 482_977_418_808_953_508n,
  feeBps: 30n,
};
export const MAINNET_MARKET: Market = { price: 75_815_549_950_000_000_000_000n, borrowingRate: ONE / 1000n, mcr: (11n * ONE) / 10n };
