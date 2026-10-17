import { describe, expect, it } from "vitest";
import {
  entryMinimums,
  entryValue,
  optimalSwap,
  priceImpact,
  quoteEntry,
  simulateEntry,
  type EntrySimulation,
  type PoolState,
} from "./entry";

const ONE = 10n ** 18n;
const S1_RESERVE_BTC = 1302678885822459557923n;

// The testnet pool at the block before each S1 entry and the Entered event that entry emitted
// (read with `cast` on 5 Oct 2026). S1 swapped a naive half (0.4995 of 0.999 net MUSD), so these
// pin the simulation to the contracts' rounding, not the optimum.
const S1 = [
  {
    tx: "0xb7c0780b",
    reserveMusd: 102598236701490816721370858n,
    totalSupply: 365577858564557757956493n,
    event: {
      btcFromSwap: 6339561438604n,
      musdAdded: 499300202429834589n,
      btcAdded: 6339561438604n,
      liquidity: 1779105604201763n,
      musdRefund: 199797570165411n,
      btcRefund: 0n,
    },
  },
  {
    tx: "0x797ae74b",
    reserveMusd: 102598237700091219151205447n,
    totalSupply: 365577860343663362158256n,
    event: {
      btcFromSwap: 6339561376900n,
      musdAdded: 499300202429809167n,
      btcAdded: 6339561376900n,
      liquidity: 1779105595543553n,
      musdRefund: 199797570190833n,
      btcRefund: 0n,
    },
  },
  {
    tx: "0x181777d2",
    reserveMusd: 102598238698691621581014614n,
    totalSupply: 365577862122768957701809n,
    event: {
      btcFromSwap: 6339561315197n,
      musdAdded: 499300202429862410n,
      btcAdded: 6339561315197n,
      liquidity: 1779105586885623n,
      musdRefund: 199797570137590n,
      btcRefund: 0n,
    },
  },
] as const;

const TESTNET: PoolState = {
  reserveMusd: S1[0].reserveMusd,
  reserveBtc: S1_RESERVE_BTC,
  totalSupply: S1[0].totalSupply,
  feeBps: 4n,
};
/** Mainnet MUSD/BTC on 5 Oct 2026: a small pool with a 30 bps fee. */
const MAINNET: PoolState = {
  reserveMusd: 136824801485852810937254n,
  reserveBtc: 1579561834237591340n,
  totalSupply: 464890506267305041405n,
  feeBps: 30n,
};
const SMALL: PoolState = { reserveMusd: 520n * ONE, reserveBtc: 6_000_000_000_000_000n, totalSupply: 1_000n * ONE, feeBps: 30n };

describe("simulateEntry", () => {
  it.each(S1)("reproduces the live S1 entry $tx to the wei", ({ reserveMusd, totalSupply, event }) => {
    const pool: PoolState = { reserveMusd, reserveBtc: S1_RESERVE_BTC, totalSupply, feeBps: 4n };
    const simulation = simulateEntry(pool, 999_000_000_000_000_000n, 499_500_000_000_000_000n);
    expect(simulation).toMatchObject(event);
  });
});

describe("optimalSwap", () => {
  it.each([
    ["testnet", TESTNET],
    ["mainnet", MAINNET],
    ["small", SMALL],
  ] as const)("leaves at most dust on the %s pool", (_name, pool) => {
    for (let exponent = 12n; exponent <= 24n; exponent++) {
      for (const mantissa of [1n, 3n, 7n]) {
        const net = mantissa * 10n ** exponent;
        if (net > pool.reserveMusd) continue;
        const swap = optimalSwap(net, pool.reserveMusd, pool.feeBps);
        expect(swap > 0n && swap < net).toBe(true);
        const simulation = simulateEntry(pool, net, swap);
        const leftover = simulation.musdRefund + (simulation.btcRefund * pool.reserveMusd) / pool.reserveBtc;
        expect(leftover <= net / 1_000_000_000n + 2n).toBe(true);
      }
    }
  });

  it("beats S1's half split, which returned 0.0002 MUSD per MUSD", () => {
    const quote = quoteEntry(TESTNET, ONE, 10n);
    expect(quote?.musdRefund).toBe(0n);
    expect(quote?.btcRefund).toBe(0n);
  });

  it("returns 0 for nothing to swap or an empty pool", () => {
    expect(optimalSwap(0n, TESTNET.reserveMusd, 4n)).toBe(0n);
    expect(optimalSwap(ONE, 0n, 4n)).toBe(0n);
  });
});

describe("quoteEntry", () => {
  it("quotes 100 MUSD on the testnet pool exactly", () => {
    expect(quoteEntry(TESTNET, 100n * ONE, 10n)).toEqual({
      musdIn: 100n * ONE,
      fee: 100_000_000_000_000_000n,
      net: 99_900_000_000_000_000_000n,
      musdToSwap: 49959979841747840226n,
      btcFromSwap: 634082500606830n,
      musdAdded: 49940020158252159774n,
      btcAdded: 634082500606830n,
      liquidity: 177946106350885866n,
      musdRefund: 0n,
      btcRefund: 0n,
      priceImpact: 400486558026992n,
      after: {
        reserveMusd: 102598336581506824784671722n,
        reserveBtc: 1302678885822459557923n,
        totalSupply: 365578036510664108842359n,
        feeBps: 4n,
      },
    });
  });

  it("measures a large trade in the small mainnet pool at about 3.75%", () => {
    expect(quoteEntry(MAINNET, 10_000n * ONE, 10n)?.priceImpact).toBe(37469591562947837n);
  });

  it("produces no BTC and no LP for dust, so the gate can block it", () => {
    expect(quoteEntry(TESTNET, 1_000n, 10n)).toMatchObject({ musdToSwap: 499n, btcFromSwap: 0n, liquidity: 0n });
    expect(quoteEntry(TESTNET, 1n, 10n)).toMatchObject({ musdToSwap: 0n, liquidity: 0n });
  });

  it("returns null for no amount or an empty pool", () => {
    expect(quoteEntry(TESTNET, 0n, 10n)).toBeNull();
    expect(quoteEntry({ ...TESTNET, totalSupply: 0n }, ONE, 10n)).toBeNull();
    expect(quoteEntry({ ...TESTNET, reserveBtc: 0n }, ONE, 10n)).toBeNull();
  });
});

describe("entryValue", () => {
  it("values the new LP share in MUSD at the pool's price before the entry (U8)", () => {
    const quote = quoteEntry(TESTNET, 100n * ONE, 10n)!;
    const shareMusd = (quote.liquidity * quote.after.reserveMusd) / quote.after.totalSupply;
    const shareBtc = (quote.liquidity * quote.after.reserveBtc) / quote.after.totalSupply;
    expect(entryValue(TESTNET, quote)).toBe(shareMusd + (shareBtc * TESTNET.reserveMusd) / TESTNET.reserveBtc);
  });

  it("stays below the amount: the fee and the swap's price impact come off", () => {
    const quote = quoteEntry(TESTNET, 100n * ONE, 10n)!;
    expect(entryValue(TESTNET, quote)).toBeLessThan(quote.net);
    expect(entryValue(TESTNET, quote)).toBeGreaterThan((quote.net * 999n) / 1000n);
  });
});

describe("priceImpact", () => {
  it("is 0 without a swap and includes the pool fee otherwise", () => {
    expect(priceImpact(TESTNET, 0n, 0n)).toBe(0n);
    // 1 MUSD on the testnet pool: the 4 bps fee plus a negligible curve effect, rounded up.
    expect(quoteEntry(TESTNET, ONE, 10n)?.priceImpact).toBe(400004865617813n);
  });
});

describe("entryMinimums", () => {
  it("takes the slippage off each expected value, rounding down", () => {
    const simulation = { btcFromSwap: 1_000n, musdAdded: 2_000n, btcAdded: 999n, liquidity: 10_001n } as EntrySimulation;
    expect(entryMinimums(simulation, 100n)).toEqual({
      minBtcFromSwap: 990n,
      minMusdAdded: 1_980n,
      minBtcAdded: 989n,
      minLpOut: 9_900n,
    });
  });
});
