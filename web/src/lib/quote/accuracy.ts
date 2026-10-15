import { entryMinimums, quoteEntry, simulateEntry, type PoolState } from "./entry";

const BPS = 10_000n;

/** One executor `Entered` event, decoded (spec 11.6). */
export type EnteredEvent = {
  blockNumber: bigint;
  logIndex: number;
  txHash: string;
  musdBorrowed: bigint;
  musdIn: bigint;
  fee: bigint;
  musdSwapped: bigint;
  btcFromSwap: bigint;
  musdAdded: bigint;
  btcAdded: bigint;
  liquidityOut: bigint;
  musdRefund: bigint;
  btcRefund: bigint;
};

export type EntryCheck = {
  feeOk: boolean;
  simulation: { ok: boolean; mismatches: string[] };
  quote: { quotedLiquidity: bigint; deviationBps: bigint; withinSlippage: boolean; optimal: boolean } | null;
};

/**
 * Checks one live entry against the quote engine (spec F8 §1). The caller chose `musdToSwap`, so the
 * simulation replays the event's own swap and must match to the wei; the quote check compares the
 * app's optimal quote with the outcome and passes within the slippage minimum.
 */
export function checkEntry(input: { event: EnteredEvent; pool: PoolState; feeBps: bigint; slippageBps: bigint }): EntryCheck {
  const { event, pool, feeBps } = input;
  const simulated = simulateEntry(pool, event.musdIn - event.fee, event.musdSwapped);
  const fields: [string, bigint, bigint][] = [
    ["btcFromSwap", simulated.btcFromSwap, event.btcFromSwap],
    ["musdAdded", simulated.musdAdded, event.musdAdded],
    ["btcAdded", simulated.btcAdded, event.btcAdded],
    ["liquidity", simulated.liquidity, event.liquidityOut],
    ["musdRefund", simulated.musdRefund, event.musdRefund],
    ["btcRefund", simulated.btcRefund, event.btcRefund],
  ];
  const mismatches = fields.filter(([, sim, live]) => sim !== live).map(([name, sim, live]) => `${name}: simulated ${sim}, event ${live}`);
  const quote = quoteEntry(pool, event.musdIn, feeBps);
  return {
    feeOk: event.fee === (event.musdIn * feeBps) / BPS,
    simulation: { ok: mismatches.length === 0, mismatches },
    quote:
      quote === null || quote.liquidity === 0n
        ? null
        : {
            quotedLiquidity: quote.liquidity,
            deviationBps: ((quote.liquidity - event.liquidityOut) * BPS) / quote.liquidity,
            withinSlippage: event.liquidityOut >= entryMinimums(quote, input.slippageBps).minLpOut,
            optimal: event.musdSwapped === quote.musdToSwap,
          },
  };
}

/** True when another transaction moved the pool earlier in the entry's block, so block − 1 is not its starting state. */
export function earlierPoolActivity(
  syncLogs: readonly { logIndex: number; transactionHash: string }[],
  event: { logIndex: number; txHash: string },
): boolean {
  return syncLogs.some((log) => log.logIndex < event.logIndex && log.transactionHash !== event.txHash);
}

export type CheckResult = { event: EnteredEvent } & (
  | { status: "checked"; check: EntryCheck }
  | { status: "skipped"; reason: string }
);

export type AccuracySummary = {
  total: number;
  checked: number;
  skipped: number;
  simulationMismatches: number;
  feeMismatches: number;
  outsideSlippage: number;
  maxDeviationBps: bigint;
  passed: boolean;
};

/** Passes with no mismatches, every quote within slippage, and at most half the events skipped. */
export function summarise(results: readonly CheckResult[]): AccuracySummary {
  const checks = results.flatMap((result) => (result.status === "checked" ? [result.check] : []));
  const skipped = results.length - checks.length;
  const simulationMismatches = checks.filter((c) => !c.simulation.ok).length;
  const feeMismatches = checks.filter((c) => !c.feeOk).length;
  const outsideSlippage = checks.filter((c) => c.quote === null || !c.quote.withinSlippage).length;
  const maxDeviationBps = checks.reduce((max, c) => {
    const deviation = c.quote === null ? 0n : c.quote.deviationBps < 0n ? -c.quote.deviationBps : c.quote.deviationBps;
    return deviation > max ? deviation : max;
  }, 0n);
  return {
    total: results.length,
    checked: checks.length,
    skipped,
    simulationMismatches,
    feeMismatches,
    outsideSlippage,
    maxDeviationBps,
    passed: simulationMismatches === 0 && feeMismatches === 0 && outsideSlippage === 0 && skipped * 2 <= results.length,
  };
}
