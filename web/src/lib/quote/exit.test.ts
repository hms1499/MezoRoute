import { describe, expect, it } from "vitest";
import { exitMinimums, quoteExit, type ExitPool } from "./exit";
import { exitGasUnits } from "./gas";

// The testnet pool at block 15903030, the block before the live smoke exit (tx 0x38a45ffe…7e30,
// read with `cast` on 12 Oct 2026). Reserves equal balances there.
const POOL: ExitPool = {
  reserveMusd: 102598256665495665120330482n,
  reserveBtc: 1302678885923892497596n,
  balanceMusd: 102598256665495665120330482n,
  balanceBtc: 1302678885923892497596n,
  totalSupply: 365577894146642543892826n,
  feeBps: 4n,
};
const LIVE_LIQUIDITY = 71164200333222588n;

describe("quoteExit", () => {
  it("replays the live smoke Exited event to the wei", () => {
    expect(quoteExit(POOL, LIVE_LIQUIDITY)).toEqual({
      liquidityIn: LIVE_LIQUIDITY,
      musdRemoved: 19972003253167101669n,
      btcRemoved: 253582349184825n,
      musdFromSwap: 19964010567181212457n,
      musdOut: 39936013820348314126n,
      priceImpact: 400194506506446n,
    });
  });

  it("burns pro rata of the token balances, not the reserves", () => {
    const donated = { ...POOL, balanceMusd: POOL.balanceMusd + 10n ** 24n };
    expect(quoteExit(donated, LIVE_LIQUIDITY)?.musdRemoved).toBe((LIVE_LIQUIDITY * donated.balanceMusd) / POOL.totalSupply);
  });

  it("returns null when Pool.burn would revert because one side rounds to zero", () => {
    expect(quoteExit(POOL, 1n)).toBeNull(); // 280 wei MUSD, 0 BTC
    expect(quoteExit(POOL, 300n)?.btcRemoved).toBe(1n);
  });

  it("returns null without liquidity or above the supply", () => {
    expect(quoteExit(POOL, 0n)).toBeNull();
    expect(quoteExit(POOL, POOL.totalSupply + 1n)).toBeNull();
    expect(quoteExit({ ...POOL, totalSupply: 0n }, 1n)).toBeNull();
  });
});

describe("exitMinimums", () => {
  it("takes the slippage off each expected value, rounded down", () => {
    expect(exitMinimums(quoteExit(POOL, LIVE_LIQUIDITY)!, 100n)).toEqual({
      minMusdRemoved: 19772283220635430652n,
      minBtcRemoved: 251046525692976n,
      minMusdFromSwap: 19764370461509400332n,
      minMusdOut: 39536653682144830984n,
    });
  });
});

describe("exitGasUnits", () => {
  it("adds the approval and the relayer's overhead per relayed call", () => {
    expect(exitGasUnits({ approve: false, smartAccount: false })).toBe(400_000n);
    expect(exitGasUnits({ approve: true, smartAccount: true })).toBe(400_000n + 60_000n + 2n * 197_471n);
  });
});
