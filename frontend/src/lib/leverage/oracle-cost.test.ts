import { describe, expect, it } from "vitest";
import { oracleCostBps, withinOracleBound } from "./oracle-cost";
import { ONE, TESTNET_MARKET } from "./test-fixtures";

describe("oracleCostBps", () => {
  it("prices testnet's 7 Nov pool/oracle gap for a buyer at ≈ 3.7% (rounded up)", () => {
    expect(oracleCostBps("buyBtc", 78_608_759_853_739_739_730_000n, ONE, TESTNET_MARKET.price)).toBe(369n);
  });

  it("is negative when the swap beats the oracle", () => {
    expect(oracleCostBps("sellBtc", 78_608n * ONE, ONE, TESTNET_MARKET.price) < 0n).toBe(true);
    expect(oracleCostBps("buyBtc", 70_000n * ONE, ONE, TESTNET_MARKET.price) < 0n).toBe(true);
  });

  it("counts a seller's shortfall below the oracle", () => {
    expect(oracleCostBps("sellBtc", 95_000n * ONE, ONE, 100_000n * ONE)).toBe(500n);
  });
});

describe("withinOracleBound", () => {
  it("uses the contract's inequality exactly", () => {
    // MezoRouteLeverage: a sale passes when btcIn × price × 1e4 ≤ musdOut × 1e18 × (1e4 + dev), so at
    // 500 bps 1 BTC must fetch ≥ 100,000 / 1.05 ≈ 95,238.1 MUSD; a buy passes when it pays ≤ 105,000.
    expect(withinOracleBound("sellBtc", 95_000n * ONE, ONE, 100_000n * ONE, 500n)).toBe(false);
    expect(withinOracleBound("sellBtc", 95_239n * ONE, ONE, 100_000n * ONE, 500n)).toBe(true);
    expect(withinOracleBound("buyBtc", 105_000n * ONE, ONE, 100_000n * ONE, 500n)).toBe(true);
    expect(withinOracleBound("buyBtc", 105_001n * ONE, ONE, 100_000n * ONE, 500n)).toBe(false);
  });
});
