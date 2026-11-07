import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { redemptionQueue, type QueueEntry } from "./queue";
import { HARNESS_MARKET, ONE } from "./test-fixtures";

const a = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
const me = a(99);
const entry = (n: number, nicr: bigint, icr: bigint, debt: bigint): QueueEntry => ({ owner: a(n), nicr, icr, debt });

describe("redemptionQueue", () => {
  const entries = [
    entry(1, 100n, (15n * ONE) / 10n, 1_000n * ONE),
    // Lower ICR than #3 (more interest owed) but a higher NICR: redemptions reach #3 first.
    entry(2, 300n, (12n * ONE) / 10n, 2_000n * ONE),
    entry(3, 200n, (13n * ONE) / 10n, 4_000n * ONE),
    entry(4, 50n, (105n * ONE) / 100n, 8_000n * ONE), // below MCR: skipped by redemptions
    entry(5, 900n, 3n * ONE, 16_000n * ONE),
    entry(99, 400n, 2n * ONE, 500n * ONE),
  ];

  it("follows list order (NICR), not ICR, and skips Troves under the MCR", () => {
    expect(redemptionQueue(entries, me, null, HARNESS_MARKET.mcr)).toEqual({ debtAhead: 7_000n * ONE, rank: 4, total: 5 });
  });

  it("re-inserts the account at its NICR after the action", () => {
    expect(redemptionQueue(entries, me, 150n, HARNESS_MARKET.mcr)).toEqual({ debtAhead: 1_000n * ONE, rank: 2, total: 5 });
  });

  it("counts ties as ahead (never flatters the position)", () => {
    expect(redemptionQueue(entries, me, 200n, HARNESS_MARKET.mcr).debtAhead).toBe(5_000n * ONE);
  });

  it("works for an account with no Trove yet (Open)", () => {
    expect(redemptionQueue(entries.slice(0, 5), me, 250n, HARNESS_MARKET.mcr)).toEqual({ debtAhead: 5_000n * ONE, rank: 3, total: 5 });
  });
});
