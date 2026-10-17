import type { ExitPool } from "@/lib/quote/exit";
import type { PositionsData, PositionsSnapshot } from "./snapshot";

// Test data only: the testnet pool at block 15903030, before the live smoke exit (cast, 12 Oct 2026).

export const ONE = 10n ** 18n;

export const LIVE_EXIT_POOL: ExitPool = {
  reserveMusd: 102598256665495665120330482n,
  reserveBtc: 1302678885923892497596n,
  balanceMusd: 102598256665495665120330482n,
  balanceBtc: 1302678885923892497596n,
  totalSupply: 365577894146642543892826n,
  feeBps: 4n,
};

/** The live exit's liquidityIn (tx 0x38a45ffe…7e30). */
export const LIVE_EXIT_LIQUIDITY = 71164200333222588n;

export function positionsSnapshotWith(overrides: Partial<PositionsSnapshot> = {}): PositionsSnapshot {
  return {
    price: 78_759_000n * 10n ** 15n, // 78,759 MUSD per BTC, close to the pool's price
    lpBalance: 2n * LIVE_EXIT_LIQUIDITY,
    pool: LIVE_EXIT_POOL,
    fees: { musd: 0n, btc: 0n },
    allowance: 0n,
    permitNonce: 0n,
    blockNumber: 15903030n,
    blockTimestamp: 1_790_903_700n,
    ...overrides,
  };
}

/** Enough BTC for the gas budget at 146 wei. */
export function positionsDataWith(overrides: Partial<PositionsData> = {}): PositionsData {
  return { snapshot: positionsSnapshotWith(), gasBalance: ONE / 1_000n, gasPrice: 146n, fetchedAt: 1_000_000, ...overrides };
}
