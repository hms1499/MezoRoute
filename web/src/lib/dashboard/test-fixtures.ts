import type { DashboardSnapshot, LpPosition, SpPosition, Trove } from "./snapshot";

// Test data only. The Trove is the deployer's real testnet Trove, read with `cast` on 5 Oct 2026.

export const ONE = 10n ** 18n;
/** 86,435.975 MUSD per BTC. */
export const FIXTURE_PRICE = 86_435_975_000_000_000_000_000n;
export const MCR = 1_100_000_000_000_000_000n;
/** 0.1%. */
export const BORROWING_RATE = 1_000_000_000_000_000n;

/** CR ≈ 188.6%; the borrowing capacity, not the 160% floor, limits new borrowing. */
export const deployerTrove: Trove = {
  collateral: 45_000_000_000_000_000n,
  principal: 2_061_860_000_000_000_000_000n,
  interest: 556_504_131_786_872_189n,
  debt: 2_062_416_504_131_786_872_189n,
  maxBorrowingCapacity: 2_304_859_297_909_090_909_090n,
};

/** The same debt on 0.036 BTC: CR ≈ 150.9%, at risk, liquidatable after a 30% drop. */
export const atRiskTrove: Trove = { ...deployerTrove, collateral: 36_000_000_000_000_000n };

/** A 10% share of a pool holding 520 MUSD and 0.006 BTC. */
export const lpShare: LpPosition = {
  balance: 100n * ONE,
  totalSupply: 1_000n * ONE,
  reserveMusd: 520n * ONE,
  reserveBtc: 6_000_000_000_000_000n,
};

export const spPosition: SpPosition = { deposit: 50n * ONE, btcGain: 20_000_000_000_000n };

export function snapshotWith(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return {
    price: FIXTURE_PRICE,
    protocol: { mcr: MCR, borrowingRate: BORROWING_RATE },
    trove: null,
    musd: 0n,
    lp: { balance: 0n, totalSupply: 0n, reserveMusd: 0n, reserveBtc: 0n },
    sp: { deposit: 0n, btcGain: 0n },
    ...overrides,
  };
}
