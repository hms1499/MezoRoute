import { describe, expect, it } from "vitest";
import { checkEntry, earlierPoolActivity, summarise, type CheckResult, type EnteredEvent, type EntryCheck } from "./accuracy";
import { DEFAULT_SLIPPAGE, quoteEntry, type PoolState } from "./entry";

// S1's first live entry (tx 0xb7c0780b…, 5 Oct 2026): 1 MUSD in, 10 bps fee, a naive half swapped.
// The pool is the testnet pool at the block before it (also used by entry.test.ts).
const S1_POOL: PoolState = {
  reserveMusd: 102598236701490816721370858n,
  reserveBtc: 1302678885822459557923n,
  totalSupply: 365577858564557757956493n,
  feeBps: 4n,
};
const S1_EVENT: EnteredEvent = {
  blockNumber: 15_936_717n,
  logIndex: 20,
  txHash: "0xb7c0780b",
  musdBorrowed: 0n,
  musdIn: 1_000_000_000_000_000_000n,
  fee: 1_000_000_000_000_000n,
  musdSwapped: 499_500_000_000_000_000n,
  btcFromSwap: 6339561438604n,
  musdAdded: 499300202429834589n,
  btcAdded: 6339561438604n,
  liquidityOut: 1779105604201763n,
  musdRefund: 199797570165411n,
  btcRefund: 0n,
};
const check = (event: EnteredEvent) => checkEntry({ event, pool: S1_POOL, feeBps: 10n, slippageBps: DEFAULT_SLIPPAGE });

describe("checkEntry", () => {
  it("reproduces S1's live entry to the wei and finds it within slippage, though not the optimal swap", () => {
    const result = check(S1_EVENT);
    expect(result.feeOk).toBe(true);
    expect(result.simulation).toEqual({ ok: true, mismatches: [] });
    expect(result.quote?.optimal).toBe(false);
    expect(result.quote?.withinSlippage).toBe(true);
    // The naive half left 0.0002 MUSD unused, so the optimal quote mints ≈0.02% more LP.
    expect(result.quote?.deviationBps).toBeGreaterThanOrEqual(1n);
    expect(result.quote?.deviationBps).toBeLessThanOrEqual(3n);
  });

  it("names every field the simulation gets wrong", () => {
    const result = check({ ...S1_EVENT, liquidityOut: S1_EVENT.liquidityOut - 1n, musdRefund: 0n });
    expect(result.simulation.ok).toBe(false);
    expect(result.simulation.mismatches).toEqual([
      `liquidity: simulated ${S1_EVENT.liquidityOut}, event ${S1_EVENT.liquidityOut - 1n}`,
      `musdRefund: simulated ${S1_EVENT.musdRefund}, event 0`,
    ]);
  });

  it("flags a fee that is not musdIn × feeBps / 10,000", () => {
    expect(check({ ...S1_EVENT, fee: S1_EVENT.fee + 1n }).feeOk).toBe(false);
  });

  it("flags an entry that minted less than the quote's minimum", () => {
    const quoted = quoteEntry(S1_POOL, S1_EVENT.musdIn, 10n)!.liquidity;
    const result = check({ ...S1_EVENT, liquidityOut: (quoted * 97n) / 100n });
    expect(result.quote?.withinSlippage).toBe(false);
    expect(result.quote?.deviationBps).toBe(300n);
  });
});

describe("earlierPoolActivity", () => {
  const entry = { logIndex: 20, txHash: "0xaaa" };

  it("ignores the entry's own swap and deposit", () => {
    expect(earlierPoolActivity([{ logIndex: 12, transactionHash: "0xaaa" }], entry)).toBe(false);
  });

  it("sees another transaction's trade earlier in the same block", () => {
    expect(earlierPoolActivity([{ logIndex: 5, transactionHash: "0xbbb" }], entry)).toBe(true);
  });

  it("ignores trades later in the block", () => {
    expect(earlierPoolActivity([{ logIndex: 30, transactionHash: "0xbbb" }], entry)).toBe(false);
  });
});

describe("summarise", () => {
  const good: EntryCheck = {
    feeOk: true,
    simulation: { ok: true, mismatches: [] },
    quote: { quotedLiquidity: 100n, deviationBps: 2n, withinSlippage: true, optimal: true },
  };
  const checked = (c: EntryCheck): CheckResult => ({ event: S1_EVENT, status: "checked", check: c });
  const skipped: CheckResult = { event: S1_EVENT, status: "skipped", reason: "same-block pool activity" };

  it("passes when every checked entry matches and stays within slippage", () => {
    const summary = summarise([checked(good), checked({ ...good, quote: { ...good.quote!, deviationBps: -5n } }), skipped]);
    expect(summary).toEqual({
      total: 3,
      checked: 2,
      skipped: 1,
      simulationMismatches: 0,
      feeMismatches: 0,
      outsideSlippage: 0,
      maxDeviationBps: 5n,
      passed: true,
    });
  });

  it("fails on a simulation mismatch, a fee mismatch, or a quote outside slippage", () => {
    expect(summarise([checked({ ...good, simulation: { ok: false, mismatches: ["x"] } })]).passed).toBe(false);
    expect(summarise([checked({ ...good, feeOk: false })]).passed).toBe(false);
    expect(summarise([checked({ ...good, quote: { ...good.quote!, withinSlippage: false } })]).passed).toBe(false);
    expect(summarise([checked({ ...good, quote: null })]).outsideSlippage).toBe(1);
  });

  it("fails when more than half the events were skipped", () => {
    expect(summarise([checked(good), skipped, skipped]).passed).toBe(false);
    expect(summarise([checked(good), skipped]).passed).toBe(true);
  });

  it("passes an empty run (nothing entered yet)", () => {
    expect(summarise([]).passed).toBe(true);
  });
});
