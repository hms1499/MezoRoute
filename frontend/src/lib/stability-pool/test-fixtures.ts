import { ONE, snapshotWith } from "@/lib/dashboard/test-fixtures";
import type { SpData, SpSnapshot } from "./snapshot";

// Test data only.

/** No deposit yet, 500 MUSD in the wallet, no allowance. */
export function spSnapshotWith(overrides: Partial<SpSnapshot> = {}): SpSnapshot {
  return { dashboard: snapshotWith({ musd: 500n * ONE }), initialDeposit: 0n, allowance: 0n, blockNumber: 16_000_000n, ...overrides };
}

/** Enough BTC for the 3,000,000-gas budget at 146 wei. */
export function spDataWith(overrides: Partial<SpData> = {}): SpData {
  return { snapshot: spSnapshotWith(), gasBalance: ONE / 1_000n, gasPrice: 146n, fetchedAt: 1_000_000, ...overrides };
}
