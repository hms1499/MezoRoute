import { snapshotWith } from "@/lib/dashboard/test-fixtures";
import type { PoolState } from "@/lib/quote/entry";
import type { LpRouteData, LpRouteSnapshot } from "./snapshot";

// Test data only: the testnet pool at block 15936716 (before S1's first entry), read with `cast`.

export const TESTNET_POOL: PoolState = {
  reserveMusd: 102598236701490816721370858n,
  reserveBtc: 1302678885822459557923n,
  totalSupply: 365577858564557757956493n,
  feeBps: 4n,
};

export const ONE = 10n ** 18n;

export function lpRouteSnapshotWith(overrides: Partial<LpRouteSnapshot> = {}): LpRouteSnapshot {
  return {
    dashboard: snapshotWith({
      musd: 500n * ONE,
      lp: { balance: 0n, totalSupply: TESTNET_POOL.totalSupply, reserveMusd: TESTNET_POOL.reserveMusd, reserveBtc: TESTNET_POOL.reserveBtc },
    }),
    pool: TESTNET_POOL,
    allowance: 0n,
    permitNonce: 0n,
    executorFeeBps: 10n,
    maxMusdIn: 1_000_000n * ONE,
    blockNumber: 15936716n,
    blockTimestamp: 1_759_600_000n,
    ...overrides,
  };
}

/** Enough BTC for the 3,000,000-gas budget at 146 wei. */
export function lpRouteDataWith(overrides: Partial<LpRouteData> = {}): LpRouteData {
  return { snapshot: lpRouteSnapshotWith(), gasBalance: ONE / 1_000n, gasPrice: 146n, fetchedAt: 1_000_000, ...overrides };
}
