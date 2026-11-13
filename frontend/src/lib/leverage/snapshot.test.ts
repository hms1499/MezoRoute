import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { parseTroveSnapshot, troveSnapshotContracts, type TroveSnapshotResults } from "./snapshot";
import { ONE } from "./test-fixtures";

const testnet = networks.testnet;
const me = "0xd74f60bb70d2A8B412fF12d8ef0ffdaAe81B2B49" as const;

// Shape of a real testnet read (deployer, 7 Nov 2026); reserves in pool order (testnet token0 = MUSD).
const results = (overrides: Partial<Record<number, unknown>> = {}): TroveSnapshotResults => {
  const base: unknown[] = [
    75_816_471_860_000_000_000_000n, // price
    (11n * ONE) / 10n, // MCR
    ONE / 1000n, // borrowing rate
    1, // status active
    [45_000_000_000_000_000n, 2_079_310_004_701_166_961_275n, 1_076_312_845_169_566_399n, 0n, 0n, 0n],
    2_304_859_297_909_090_909_090n, // capacity
    100, // interest rate bps
    [102_508_838_208_363_834_410_753_493n, 1_304_038_359_072_103_894_648n, 1_794_018_000n],
    4n, // pool fee
    1_000n * ONE, // system coll
    20_000_000n * ONE, // system debt
    (15n * ONE) / 10n, // CCR
    367n, // Trove count
    7n, // BOS nonce
    3n, // MUSD permit nonce
    1n, // BTC permit nonce
    2_044n * ONE, // wallet MUSD
    51_210_620_649_204_467n, // wallet BTC
    0n, // surplus BTC
    16_622_200n, // block
    1_794_019_000n, // timestamp
    100, // new-Trove interest rate bps (InterestRateManager.interestRate)
  ];
  for (const [i, v] of Object.entries(overrides)) base[Number(i)] = v;
  return base as unknown as TroveSnapshotResults;
};

describe("troveSnapshotContracts", () => {
  it("reads everything on the selected chain in one multicall", () => {
    const calls = troveSnapshotContracts(testnet, me);
    expect(calls).toHaveLength(22);
    expect(calls.every((c) => c.chainId === testnet.chainId)).toBe(true);
  });

  it("ends with the rate a new Trove gets, on both networks (U20)", () => {
    for (const network of [networks.testnet, networks.mainnet]) {
      const last = troveSnapshotContracts(network, me).at(-1)!;
      expect(last).toMatchObject({ address: network.addresses.interestRateManager, functionName: "interestRate" });
    }
    expect(networks.testnet.addresses.interestRateManager).toBe("0xD4D6c36A592A2c5e86035A6bca1d57747a567f37");
    expect(networks.mainnet.addresses.interestRateManager).toBe("0x4a453700d157717Fe02fB62E7700ED7845048285");
  });
});

describe("parseTroveSnapshot", () => {
  it("maps the Trove, the pool by token order, and the nonces", () => {
    const s = parseTroveSnapshot(testnet, results());
    expect(s.trove).toEqual({
      coll: 45_000_000_000_000_000n,
      principal: 2_079_310_004_701_166_961_275n,
      interest: 1_076_312_845_169_566_399n,
      debt: 2_079_310_004_701_166_961_275n + 1_076_312_845_169_566_399n,
      maxBorrowingCapacity: 2_304_859_297_909_090_909_090n,
      interestRateBps: 100n,
    });
    expect(s.pool).toEqual({ reserveMusd: 102_508_838_208_363_834_410_753_493n, reserveBtc: 1_304_038_359_072_103_894_648n, feeBps: 4n });
    expect(s.bosNonce).toBe(7n);
    expect(s.btcPermitNonce).toBe(1n);
    expect(s.recoveryMode).toBe(false);
    expect(s.block).toEqual({ number: 16_622_200n, timestamp: 1_794_019_000n });
    expect(s.newTroveRateBps).toBe(100n);
  });

  it("never adds pending redistribution twice (getEntireDebtAndColl already folds it in)", () => {
    const s = parseTroveSnapshot(testnet, results({ 4: [ONE, 1_000n * ONE, ONE, ONE / 10n, 50n * ONE, ONE / 2n] }));
    expect(s.trove?.coll).toBe(ONE);
    expect(s.trove?.principal).toBe(1_000n * ONE);
    expect(s.trove?.interest).toBe(ONE);
  });

  it("has no Trove unless the status is active, and computes Recovery Mode locally", () => {
    expect(parseTroveSnapshot(testnet, results({ 3: 2 })).trove).toBeNull();
    // TCR = 1,000 BTC × 75,816 / 60M ≈ 126% < 150%
    expect(parseTroveSnapshot(testnet, results({ 10: 60_000_000n * ONE })).recoveryMode).toBe(true);
  });
});
