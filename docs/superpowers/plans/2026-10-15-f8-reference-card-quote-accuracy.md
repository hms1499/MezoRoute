# F8 Mainnet Reference Card and Quote-Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two deliverables. On testnet, a "Mainnet today" reference card on the dashboard shows live mainnet pool, Stability Pool, and 30-day figures. Separately, `npm run quote-accuracy` checks the quote engine against every live executor `Entered` event.

**Architecture:**
- **Shared pure logic:**
  - `web/src/lib/quote/accuracy.ts` holds the per-event checks and the summary.
  - `web/src/lib/reference/` holds the mainnet head multicall, the parsing, the view figures, and a loader that splits head and history failures.
- **Reference card:** reads mainnet through its own viem client, built from the new `NetworkConfig.rpcUrl`. Its 30-day rows reuse F6's `fetchRouteHistory`.
- **Quote-accuracy script:** a Vitest file under a separate config, so it keeps the `@/` aliases and TypeScript without a new dependency.

**Tech Stack:** Next.js 14.2.35 static export, React 18.3.1, wagmi 2.19.5, viem 2.57.2, TanStack Query 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-15-f8-reference-card-quote-accuracy-design.md`. Read it first; its chain facts were verified on 15 Oct 2026.

## Global Constraints

- **Branch and staging:** work on `feat/f8-reference-card` in `/Users/vanhuy/Desktop/mezoroute`. The branch already exists and holds the spec commit; there is no worktree. Run `git branch --show-current` before each commit. Stage explicit paths. Check that there are no `* 2*` iCloud duplicates.
- **Commits:** use the prefixes `feat(web):`, `fix(web):`, `test(web):`, `docs:`. Every message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Scope:** no dependency changes, no contract changes. Addresses come from `network.addresses`, RPC URLs from `network.rpcUrl`.
- **Units:** all amounts are `bigint`, where 1e18 = 1 MUSD = 1 BTC = 100%. Divisions round down.
- **Copy:** English. Never use "profit", "APY", "guaranteed", or "risk-free". Mainnet data stays visually and textually separate from testnet data (PRODUCT_SPEC §9).
- **Rendering:** never build clients or wagmi config in render. Never let `WagmiProvider` re-render (CLAUDE.md).
- **Query keys:** TanStack Query keys hold no `bigint`.
- **Commands:** run `npm` from `web/`. UI tasks also run `npm run build`. Never build while `npm run dev` runs.

## Review Focus

- **The mainnet RPC is down while the user is on testnet.** The reference card shows "Mainnet data unavailable" with Retry, and the rest of the dashboard is unaffected. Pinned in Task 4 ("rejects when the head read fails").
- **The mainnet RPC lacks archive state, or the history read times out.** Only the 30-day rows read "Unavailable"; the reserves and deposits still show. Pinned in Task 4 ("keeps the head figures when the history fails").
- **Another trade touched the pool earlier in the same block as an entry.** The script must skip that event, not report a false mismatch. Pinned in Task 2 (`earlierPoolActivity`).
- **The RPC fails on most events, leaving one or two checked.** The run must fail, not "pass" on almost no evidence. Pinned in Task 2 ("fails when more than half the events were skipped").
- **The executor's on-chain fee differs from the pinned config.** The script stops before checking, because every fee check would be wrong. Pinned in Task 3 (the `expect(chainFee)` assertion, exercised by the live run).

---

### Task 1: RPC URL per network

**Files:**
- Modify: `web/src/lib/config/networks.ts`
- Modify: `web/src/lib/config/networks.test.ts`

**Interfaces:**
- Produces: `NetworkConfig.rpcUrl: string`, with testnet `"https://rpc.test.mezo.org"` and mainnet `"https://rpc-internal.mezo.org"`.

- [ ] **Step 1: Write the failing test**

In `web/src/lib/config/networks.test.ts`, add inside `describe("networks", …)`, after the chain-id test:

```ts
  it("reads through the RPCs Passport's chains use (viem's rpc.mezo.org has no DNS record)", () => {
    expect(networks.testnet.rpcUrl).toBe(mezoTestnet.rpcUrls.default.http[0]);
    expect(networks.mainnet.rpcUrl).toBe(mezoMainnet.rpcUrls.default.http[0]);
    expect([networks.testnet.rpcUrl, networks.mainnet.rpcUrl]).toEqual(["https://rpc.test.mezo.org", "https://rpc-internal.mezo.org"]);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd web && npx vitest run src/lib/config/networks.test.ts`
Expected: FAIL, because `rpcUrl` is `undefined`.

- [ ] **Step 3: Add the field**

In `web/src/lib/config/networks.ts`, add to `NetworkConfig`, after `name`:

```ts
  /** JSON-RPC endpoint Passport's chain uses; the mainnet reference card and the quote-accuracy script read through it. */
  rpcUrl: string;
```

Then add `rpcUrl: "https://rpc.test.mezo.org",` to the testnet entry and `rpcUrl: "https://rpc-internal.mezo.org",` to the mainnet entry, each after `name`.

- [ ] **Step 4: Run the tests and the type check**

Run: `cd web && npx vitest run src/lib/config && npx tsc --noEmit`
Expected: PASS, with no type errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/config/networks.ts web/src/lib/config/networks.test.ts
git commit -m "feat(web): RPC URL per network

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Quote-accuracy checks

**Files:**
- Create: `web/src/lib/quote/accuracy.ts`
- Create: `web/src/lib/quote/accuracy.test.ts`

**Interfaces:**
- Consumes: `simulateEntry`, `quoteEntry`, `entryMinimums`, `PoolState`, and `DEFAULT_SLIPPAGE` from `./entry`.
- Produces:
  - `type EnteredEvent = { blockNumber: bigint; logIndex: number; txHash: string; musdBorrowed; musdIn; fee; musdSwapped; btcFromSwap; musdAdded; btcAdded; liquidityOut; musdRefund; btcRefund: bigint }`.
  - `type EntryCheck = { feeOk: boolean; simulation: { ok: boolean; mismatches: string[] }; quote: { quotedLiquidity: bigint; deviationBps: bigint; withinSlippage: boolean; optimal: boolean } | null }`.
  - `checkEntry(input: { event: EnteredEvent; pool: PoolState; feeBps: bigint; slippageBps: bigint }): EntryCheck`.
  - `earlierPoolActivity(syncLogs: readonly { logIndex: number; transactionHash: string }[], event: { logIndex: number; txHash: string }): boolean`.
  - `type CheckResult = { event: EnteredEvent } & ({ status: "checked"; check: EntryCheck } | { status: "skipped"; reason: string })`.
  - `type AccuracySummary = { total; checked; skipped; simulationMismatches; feeMismatches; outsideSlippage: number; maxDeviationBps: bigint; passed: boolean }`.
  - `summarise(results: readonly CheckResult[]): AccuracySummary`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/quote/accuracy.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd web && npx vitest run src/lib/quote/accuracy.test.ts`
Expected: FAIL with "Cannot find module './accuracy'".

- [ ] **Step 3: Implement `accuracy.ts`**

Create `web/src/lib/quote/accuracy.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `cd web && npx vitest run src/lib/quote/accuracy.test.ts`
Expected: PASS. If the S1 `deviationBps` lands outside 1–3, read the actual value, check it against the hand estimate (S1 refunded 0.0002 of 0.999 MUSD, ≈2 bps), and ledger a ruling before adjusting the bound.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/quote/accuracy.ts web/src/lib/quote/accuracy.test.ts
git commit -m "feat(web): quote-accuracy checks against live Entered events

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Quote-accuracy script

**Files:**
- Create: `web/vitest.live.config.ts`
- Create: `web/scripts/live/quote-accuracy.live.ts`
- Modify: `web/package.json` (scripts)

**Interfaces:**
- Consumes:
  - `checkEntry`, `earlierPoolActivity`, `summarise`, `CheckResult`, and `EnteredEvent` (Task 2).
  - `networks` and `rpcUrl` (Task 1).
  - `musdIsToken0` from `@/lib/dashboard/snapshot`.
  - `mezoRouteExecutorAbi` from `@/lib/abi/mezoRouteExecutor`.
  - `poolAbi` and `poolFactoryAbi` from `@/lib/abi/pool`.
  - `DEFAULT_SLIPPAGE` from `@/lib/quote/entry`.
- Produces: `npm run quote-accuracy` (testnet), and `QUOTE_NETWORK=mainnet npm run quote-accuracy`.

- [ ] **Step 1: Add the live config and the npm script**

Create `web/vitest.live.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Live checks against a real chain (spec F8): never part of `npm test`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["scripts/live/**/*.live.ts"], testTimeout: 600_000 },
});
```

In `web/package.json` `scripts`, add after `"test": "vitest run",`:

```json
    "quote-accuracy": "vitest run -c vitest.live.config.ts",
```

- [ ] **Step 2: Write the script**

Create `web/scripts/live/quote-accuracy.live.ts`:

```ts
import { createPublicClient, http, parseAbiItem } from "viem";
import { expect, it } from "vitest";
import { mezoRouteExecutorAbi } from "@/lib/abi/mezoRouteExecutor";
import { poolAbi, poolFactoryAbi } from "@/lib/abi/pool";
import { networks, type NetworkId } from "@/lib/config/networks";
import { musdIsToken0 } from "@/lib/dashboard/snapshot";
import { checkEntry, earlierPoolActivity, summarise, type CheckResult, type EnteredEvent } from "@/lib/quote/accuracy";
import { DEFAULT_SLIPPAGE, type PoolState } from "@/lib/quote/entry";

// Spec F8 §2: every executor Entered event against the quote engine. Run from web/:
//   npm run quote-accuracy                          (testnet)
//   QUOTE_NETWORK=mainnet npm run quote-accuracy    (after M1)

const LOG_RANGE = 10_000n;
const SYNC = parseAbiItem("event Sync(uint256 reserve0, uint256 reserve1)");
const id = (process.env.QUOTE_NETWORK ?? "testnet") as NetworkId;

function required(value: bigint | undefined, name: string): bigint {
  if (value === undefined) throw new Error(`Entered event without ${name}`);
  return value;
}

it(`quotes match every live Entered event on ${id}`, async () => {
  const network = networks[id];
  if (!network) throw new Error(`Unknown QUOTE_NETWORK "${id}" (use testnet or mainnet)`);
  const executor = network.executor;
  if (!executor) {
    console.log(`No executor on ${network.name} yet: nothing to check.`);
    return;
  }
  const a = network.addresses;
  const client = createPublicClient({ transport: http(network.rpcUrl) });
  const chainFee = await client.readContract({ address: executor.address, abi: mezoRouteExecutorAbi, functionName: "feeBps" });
  expect(chainFee, "the executor's on-chain fee differs from the pinned config").toBe(executor.feeBps);

  const head = await client.getBlockNumber();
  const events: EnteredEvent[] = [];
  for (let from = executor.deployBlock; from <= head; from += LOG_RANGE) {
    const to = from + LOG_RANGE - 1n > head ? head : from + LOG_RANGE - 1n; // Mezo returns nothing past the head
    const logs = await client.getContractEvents({
      address: executor.address,
      abi: mezoRouteExecutorAbi,
      eventName: "Entered",
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) {
      if (log.eventName !== "Entered") continue; // viem decodes whichever event the topic matches
      const e = log.args;
      events.push({
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        txHash: log.transactionHash,
        musdBorrowed: required(e.musdBorrowed, "musdBorrowed"),
        musdIn: required(e.musdIn, "musdIn"),
        fee: required(e.fee, "fee"),
        musdSwapped: required(e.musdSwapped, "musdSwapped"),
        btcFromSwap: required(e.btcFromSwap, "btcFromSwap"),
        musdAdded: required(e.musdAdded, "musdAdded"),
        btcAdded: required(e.btcAdded, "btcAdded"),
        liquidityOut: required(e.liquidityOut, "liquidityOut"),
        musdRefund: required(e.musdRefund, "musdRefund"),
        btcRefund: required(e.btcRefund, "btcRefund"),
      });
    }
  }

  const musdFirst = musdIsToken0(network);
  const poolAt = async (blockNumber: bigint): Promise<PoolState> => {
    const [reserves, totalSupply, feeBps] = await client.multicall({
      contracts: [
        { address: a.pool, abi: poolAbi, functionName: "getReserves" },
        { address: a.pool, abi: poolAbi, functionName: "totalSupply" },
        { address: a.poolFactory, abi: poolFactoryAbi, functionName: "getFee", args: [a.pool, false] },
      ],
      blockNumber,
      allowFailure: false,
      multicallAddress: a.multicall3,
    });
    return {
      reserveMusd: musdFirst ? reserves[0] : reserves[1],
      reserveBtc: musdFirst ? reserves[1] : reserves[0],
      totalSupply,
      feeBps,
    };
  };

  const results: CheckResult[] = [];
  for (const event of events) {
    try {
      const syncs = await client.getLogs({ address: a.pool, event: SYNC, fromBlock: event.blockNumber, toBlock: event.blockNumber });
      if (earlierPoolActivity(syncs, event)) {
        results.push({ event, status: "skipped", reason: "same-block pool activity" });
        continue;
      }
      const pool = await poolAt(event.blockNumber - 1n);
      results.push({ event, status: "checked", check: checkEntry({ event, pool, feeBps: executor.feeBps, slippageBps: DEFAULT_SLIPPAGE }) });
    } catch (error) {
      results.push({ event, status: "skipped", reason: `pool state unavailable: ${(error as Error).message.split("\n")[0]}` });
    }
  }

  console.table(
    results.map((r) => ({
      block: r.event.blockNumber.toString(),
      tx: `${r.event.txHash.slice(0, 10)}…`,
      musdIn: (Number(r.event.musdIn) / 1e18).toString(),
      borrowed: r.event.musdBorrowed > 0n ? "yes" : "",
      result:
        r.status === "skipped"
          ? `skipped: ${r.reason}`
          : [
              r.check.simulation.ok ? "simulation exact" : `simulation: ${r.check.simulation.mismatches.join("; ")}`,
              r.check.feeOk ? "fee ok" : "FEE MISMATCH",
              r.check.quote === null
                ? "no quote"
                : `${r.check.quote.optimal ? "optimal swap" : "caller's own swap"}, deviation ${r.check.quote.deviationBps} bps, ${r.check.quote.withinSlippage ? "within" : "OUTSIDE"} ${DEFAULT_SLIPPAGE} bps`,
            ].join(" · "),
    })),
  );
  const summary = summarise(results);
  console.log(JSON.stringify({ network: network.name, head: head.toString(), ...summary, maxDeviationBps: summary.maxDeviationBps.toString() }, null, 2));
  expect(summary.passed).toBe(true);
});
```

- [ ] **Step 3: Type-check, then run it on testnet**

Run: `cd web && npx tsc --noEmit && npm run quote-accuracy 2>&1 | tail -40`
Expected: no type errors. Then a table of 14 testnet entries and a summary with `passed: true`. "simulation exact" and "fee ok" show for every checked row. Some rows may be `skipped: same-block pool activity` (6 of the 14 were the second transaction of their block), but no more than half.
- If the run fails, read which check failed before changing anything:
  - A simulation mismatch on a checked row is a real finding; use systematic debugging.
  - A skip rate above half is also a finding. Inspect those blocks' `Sync` logs with `cast logs`.
- Record the summary JSON in the ledger.

- [ ] **Step 4: Run it on mainnet (no executor yet)**

Run: `cd web && QUOTE_NETWORK=mainnet npm run quote-accuracy 2>&1 | tail -8`
Expected: "No executor on Mezo Mainnet yet: nothing to check.", and the test passes.

- [ ] **Step 5: Confirm `npm test` does not pick it up**

Run: `cd web && npx vitest run 2>&1 | grep -c "quote-accuracy.live"`
Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add web/vitest.live.config.ts web/scripts/live/quote-accuracy.live.ts web/package.json
git commit -m "feat(web): quote-accuracy script over live Entered events

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Mainnet reference data

**Files:**
- Modify: `web/src/lib/abi/musd.ts` (SP `getTotalMUSDDeposits`)
- Modify: `web/src/lib/compare/history.ts` (`HistoryClient.multicall` takes an optional `blockNumber`)
- Create: `web/src/lib/reference/snapshot.ts`
- Create: `web/src/lib/reference/snapshot.test.ts`
- Create: `web/src/lib/reference/load.ts`
- Create: `web/src/lib/reference/load.test.ts`

**Interfaces:**
- Consumes:
  - `fetchRouteHistory`, `backtestRoutes`, `withTimeout`, `HISTORY_TIMEOUT_MS`, `HistoryClient`, and `RouteBacktests` from `@/lib/compare/history`.
  - `REFERENCE_AMOUNT` from `@/lib/compare/view`.
  - `musdIsToken0`.
  - `networks`.
- Produces:
  - `referenceContracts(network: NetworkConfig)`.
  - `type ReferenceResults`.
  - `type MainnetReference = { reserveMusd; reserveBtc; lpSupply; feeBps; price; musdSupply; spDeposits: bigint }`.
  - `parseReference(network, results): MainnetReference`.
  - `referenceView(reference): { poolTvl: bigint; spShare: bigint }`.
  - `type MainnetReferenceData = { reference: MainnetReference; backtests: RouteBacktests | null }`.
  - `loadMainnetReference(client: HistoryClient, timeoutMs?: number): Promise<MainnetReferenceData>`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/reference/snapshot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { WAD } from "@/lib/math";
import { parseReference, referenceContracts, referenceView, type ReferenceResults } from "./snapshot";

const ONE = WAD;
const network = networks.mainnet;

// Mainnet on 15 Oct 2026 (cast): token0 is BTC.
const RESULTS: ReferenceResults = [
  [1_252_333_046_250_689_046n, 101_720_411_561_710_585_148_464n, 1_792_028_034n],
  356_914_278_883_031_761_432n,
  30n,
  81_669_799_990_000_000_000_000n,
  29_871_966_506_620_911_511_760_946n,
  14_172_031_977_066_897_384_115_018n,
];

describe("referenceContracts", () => {
  it("reads only mainnet's own contracts", () => {
    const allowed: string[] = Object.values(network.addresses);
    for (const call of referenceContracts(network)) expect(allowed).toContain(call.address);
    expect(referenceContracts(network).map((c) => c.functionName)).toEqual([
      "getReserves",
      "totalSupply",
      "getFee",
      "fetchPrice",
      "totalSupply",
      "getTotalMUSDDeposits",
    ]);
  });
});

describe("parseReference", () => {
  it("maps mainnet reserves by address (BTC is token0)", () => {
    expect(parseReference(network, RESULTS)).toEqual({
      reserveMusd: 101_720_411_561_710_585_148_464n,
      reserveBtc: 1_252_333_046_250_689_046n,
      lpSupply: 356_914_278_883_031_761_432n,
      feeBps: 30n,
      price: 81_669_799_990_000_000_000_000n,
      musdSupply: 29_871_966_506_620_911_511_760_946n,
      spDeposits: 14_172_031_977_066_897_384_115_018n,
    });
  });
});

describe("referenceView", () => {
  const base = parseReference(network, RESULTS);

  it("values the pool in MUSD at the oracle price and gives the Stability Pool's share of supply", () => {
    const view = referenceView({ ...base, reserveMusd: 100n * ONE, reserveBtc: ONE / 2n, price: 80_000n * ONE, spDeposits: 14n * ONE, musdSupply: 28n * ONE });
    expect(view).toEqual({ poolTvl: 40_100n * ONE, spShare: ONE / 2n });
  });

  it("reads the live mainnet share as 47.4%", () => {
    const { spShare } = referenceView(base);
    expect(spShare).toBeGreaterThan(474_000_000_000_000_000n);
    expect(spShare).toBeLessThan(475_000_000_000_000_000n);
  });

  it("gives a zero share without MUSD supply", () => {
    expect(referenceView({ ...base, musdSupply: 0n }).spShare).toBe(0n);
  });
});
```

Create `web/src/lib/reference/load.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { HistoryClient } from "@/lib/compare/history";
import { loadMainnetReference } from "./load";

const HEAD_RESULTS = [
  [1_252_333_046_250_689_046n, 101_720_411_561_710_585_148_464n, 1_792_028_034n],
  356_914_278_883_031_761_432n,
  30n,
  81_669_799_990_000_000_000_000n,
  29_871_966_506_620_911_511_760_946n,
  14_172_031_977_066_897_384_115_018n,
];

/** Head reads have no blockNumber; F6's history reads always pass one. */
function client(options: { headFails?: boolean; historyFails?: boolean }): HistoryClient {
  return {
    async getBlock() {
      if (options.historyFails) throw new Error("missing trie node");
      throw new Error("unexpected history read");
    },
    async multicall({ blockNumber }) {
      if (blockNumber !== undefined) throw new Error("unexpected history multicall");
      if (options.headFails) throw new Error("fetch failed");
      return HEAD_RESULTS;
    },
  };
}

describe("loadMainnetReference", () => {
  it("keeps the head figures when the history fails (no archive state, timeout)", async () => {
    const data = await loadMainnetReference(client({ historyFails: true }));
    expect(data.backtests).toBeNull();
    expect(data.reference.spDeposits).toBe(14_172_031_977_066_897_384_115_018n);
  });

  it("rejects when the head read fails, so the card shows its unavailable state", async () => {
    await expect(loadMainnetReference(client({ headFails: true, historyFails: true }))).rejects.toThrow("fetch failed");
  });

  it("times out a hanging head read", async () => {
    const hanging: HistoryClient = { getBlock: () => new Promise(() => {}), multicall: () => new Promise(() => {}) };
    await expect(loadMainnetReference(hanging, 10)).rejects.toThrow("Timed out");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd web && npx vitest run src/lib/reference`
Expected: FAIL with "Cannot find module './snapshot'" and "Cannot find module './load'".

- [ ] **Step 3: Add the ABI getter and loosen `HistoryClient`**

In `web/src/lib/abi/musd.ts`, add to `stabilityPoolAbi`, after `"function epochToScaleToSum(uint128 epoch, uint128 scale) view returns (uint256)",`:

```ts
  "function getTotalMUSDDeposits() view returns (uint256)",
```

In `web/src/lib/compare/history.ts`, change `HistoryClient`'s multicall argument from `blockNumber: bigint;` to `blockNumber?: bigint; // omitted: the latest block`. `fetchRouteHistory` keeps passing it.

- [ ] **Step 4: Implement `snapshot.ts`**

Create `web/src/lib/reference/snapshot.ts`:

```ts
import { erc20Abi } from "viem";
import { priceFeedAbi, stabilityPoolAbi } from "@/lib/abi/musd";
import { poolAbi, poolFactoryAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";
import { musdIsToken0 } from "@/lib/dashboard/snapshot";
import { WAD } from "@/lib/math";

/** Mainnet today, for the testnet reference card (spec F8 §1). */
export type MainnetReference = {
  reserveMusd: bigint;
  reserveBtc: bigint;
  lpSupply: bigint;
  feeBps: bigint;
  price: bigint; // oracle, MUSD per BTC
  musdSupply: bigint;
  spDeposits: bigint;
};

export type ReferenceResults = readonly [
  reserves: readonly [bigint, bigint, bigint],
  lpSupply: bigint,
  feeBps: bigint,
  price: bigint,
  musdSupply: bigint,
  spDeposits: bigint,
];

/** One multicall at the head; no chainId, because the card's own mainnet client sends it. */
export function referenceContracts(network: NetworkConfig) {
  const a = network.addresses;
  return [
    { address: a.pool, abi: poolAbi, functionName: "getReserves" },
    { address: a.pool, abi: poolAbi, functionName: "totalSupply" },
    { address: a.poolFactory, abi: poolFactoryAbi, functionName: "getFee", args: [a.pool, false] },
    { address: a.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" },
    { address: a.musd, abi: erc20Abi, functionName: "totalSupply" },
    { address: a.stabilityPool, abi: stabilityPoolAbi, functionName: "getTotalMUSDDeposits" },
  ] as const;
}

export function parseReference(network: NetworkConfig, results: ReferenceResults): MainnetReference {
  const [reserves, lpSupply, feeBps, price, musdSupply, spDeposits] = results;
  const musdFirst = musdIsToken0(network);
  return {
    reserveMusd: musdFirst ? reserves[0] : reserves[1],
    reserveBtc: musdFirst ? reserves[1] : reserves[0],
    lpSupply,
    feeBps,
    price,
    musdSupply,
    spDeposits,
  };
}

/** Pool value in MUSD at the oracle price, and the Stability Pool's share of MUSD supply (1e18 = 100%). */
export function referenceView(reference: MainnetReference): { poolTvl: bigint; spShare: bigint } {
  return {
    poolTvl: reference.reserveMusd + (reference.reserveBtc * reference.price) / WAD,
    spShare: reference.musdSupply === 0n ? 0n : (reference.spDeposits * WAD) / reference.musdSupply,
  };
}
```

- [ ] **Step 5: Implement `load.ts`**

Create `web/src/lib/reference/load.ts`:

```ts
import {
  backtestRoutes,
  fetchRouteHistory,
  HISTORY_TIMEOUT_MS,
  withTimeout,
  type HistoryClient,
  type RouteBacktests,
} from "@/lib/compare/history";
import { REFERENCE_AMOUNT } from "@/lib/compare/view";
import { networks } from "@/lib/config/networks";
import { parseReference, referenceContracts, type MainnetReference, type ReferenceResults } from "./snapshot";

export type MainnetReferenceData = { reference: MainnetReference; backtests: RouteBacktests | null };

/**
 * The head figures and F6's 30-day history, fetched side by side (spec F8 §4): a failed head read
 * fails the card; a failed history read (no archive state, timeout) only blanks the 30-day rows.
 */
export async function loadMainnetReference(client: HistoryClient, timeoutMs = HISTORY_TIMEOUT_MS): Promise<MainnetReferenceData> {
  const network = networks.mainnet;
  const [head, history] = await Promise.allSettled([
    withTimeout(
      client.multicall({ contracts: referenceContracts(network), allowFailure: false, multicallAddress: network.addresses.multicall3 }),
      timeoutMs,
    ),
    withTimeout(fetchRouteHistory(client, network), timeoutMs),
  ]);
  if (head.status === "rejected") throw head.reason;
  return {
    reference: parseReference(network, head.value as unknown as ReferenceResults),
    backtests: history.status === "fulfilled" ? backtestRoutes(history.value, REFERENCE_AMOUNT, 0n) : null,
  };
}
```

- [ ] **Step 6: Run the tests and the type check**

Run: `cd web && npx vitest run src/lib/reference src/lib/compare && npx tsc --noEmit`
Expected: PASS (F6's history tests still pass), with no type errors.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/abi/musd.ts web/src/lib/compare/history.ts web/src/lib/reference/snapshot.ts web/src/lib/reference/snapshot.test.ts web/src/lib/reference/load.ts web/src/lib/reference/load.test.ts
git commit -m "feat(web): mainnet reference data: head figures and 30-day history, failing apart

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Mainnet reference card on the testnet dashboard

**Files:**
- Create: `web/src/lib/reference/useMainnetReference.ts`
- Create: `web/src/components/dashboard/MainnetReferenceCard.tsx`
- Modify: `web/src/components/dashboard/Dashboard.tsx`

**Interfaces:**
- Consumes:
  - `loadMainnetReference` and `MainnetReferenceData` (Task 4), `referenceView` (Task 4).
  - `lpHistoryLine` and `spHistoryLine` from `@/lib/compare/view`.
  - `StatRow`, `useNetwork`, and `formatToken`/`formatPercent`/`formatBps`.
- Produces:
  - `useMainnetReference(enabled: boolean): { data: MainnetReferenceData | undefined; error: Error | null; retry: () => void }`.
  - `<MainnetReferenceCard />`, which renders nothing on mainnet.

- [ ] **Step 1: Add the hook**

Create `web/src/lib/reference/useMainnetReference.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, type PublicClient } from "viem";
import type { HistoryClient } from "@/lib/compare/history";
import { networks } from "@/lib/config/networks";
import { loadMainnetReference, type MainnetReferenceData } from "./load";

const STALE_MS = 5 * 60_000;

// The wagmi config only knows the selected network, so the testnet dashboard reads mainnet through its
// own client, built once on first use (never in render).
let client: PublicClient | undefined;
function mainnetClient(): PublicClient {
  client ??= createPublicClient({ transport: http(networks.mainnet.rpcUrl) });
  return client;
}

export function useMainnetReference(enabled: boolean): {
  data: MainnetReferenceData | undefined;
  error: Error | null;
  retry: () => void;
} {
  const query = useQuery({
    queryKey: ["mainnet-reference"],
    enabled,
    staleTime: STALE_MS,
    retry: false,
    queryFn: () => loadMainnetReference(mainnetClient() as unknown as HistoryClient),
  });
  return { data: query.data, error: query.error, retry: () => void query.refetch() };
}
```

- [ ] **Step 2: Build the card**

Create `web/src/components/dashboard/MainnetReferenceCard.tsx`:

```tsx
"use client";

import { lpHistoryLine, spHistoryLine } from "@/lib/compare/view";
import { useNetwork } from "@/lib/config/network-context";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { referenceView } from "@/lib/reference/snapshot";
import { useMainnetReference } from "@/lib/reference/useMainnetReference";
import { StatRow } from "./StatRow";

const CARD = "rounded-2xl border border-dashed border-line bg-canvas p-5";
const FOOTER = "Read from Mezo mainnet. MezoRoute executes on testnet until launch. Past results, not a forecast.";

/** Spec §9 screen 1: mainnet's pool and Stability Pool today, kept apart from testnet execution data. */
export function MainnetReferenceCard() {
  const { network } = useNetwork();
  const onTestnet = network.id === "testnet";
  const { data, error, retry } = useMainnetReference(onTestnet);
  if (!onTestnet) return null;

  if (!data && error) {
    return (
      <section id="mainnet-reference" className={CARD}>
        <Header />
        <p className="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
          Mainnet data unavailable.
          <button type="button" onClick={retry} className="text-xs font-semibold text-accent underline">
            Retry
          </button>
        </p>
      </section>
    );
  }
  if (!data) return <div aria-busy="true" aria-label="Loading mainnet reference" className={`${CARD} h-56 animate-pulse`} />;

  const { reference: r, backtests } = data;
  const view = referenceView(r);
  return (
    <section id="mainnet-reference" className={CARD}>
      <Header />
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">MUSD/BTC pool</h3>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <StatRow label="Reserves" sub={`+ ${formatToken(r.reserveBtc, 18, 4)} BTC`}>
              {formatToken(r.reserveMusd, 18, 0)} MUSD
            </StatRow>
            <StatRow label="Value">≈ {formatToken(view.poolTvl, 18, 0)} MUSD</StatRow>
            <StatRow label="Swap fee">{formatBps(r.feeBps)}</StatRow>
            <StatRow label="LP fees, last 30 days">{backtests?.lp ? lpHistoryLine(backtests.lp) : "Unavailable"}</StatRow>
          </dl>
        </div>
        <div>
          <h3 className="text-sm font-medium">Stability Pool</h3>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <StatRow label="Deposits">{formatToken(r.spDeposits, 18, 0)} MUSD</StatRow>
            <StatRow label="Share of MUSD supply" sub={`of ${formatToken(r.musdSupply, 18, 0)} MUSD`}>
              {formatPercent(view.spShare, 1)}
            </StatRow>
            <StatRow label="Last 30 days">{backtests ? spHistoryLine(backtests.sp) : "Unavailable"}</StatRow>
          </dl>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-muted">{FOOTER}</p>
    </section>
  );
}

function Header() {
  return (
    <h2 className="flex flex-wrap items-center justify-between gap-2 font-semibold">
      Mainnet today
      <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">
        Mainnet · reference only
      </span>
    </h2>
  );
}
```

- [ ] **Step 3: Put it on the dashboard**

In `web/src/components/dashboard/Dashboard.tsx`:
- Add `import { MainnetReferenceCard } from "./MainnetReferenceCard";` after the `ExposurePanel` import.
- In `DashboardBody`, add `<MainnetReferenceCard />` as the last element, after `<PositionsSummary … />`.
- Change the `Dashboard` doc comment to `/** The connected home page (spec §9 screen 1): warning, readiness, Trove, exposure, route comparison, positions, mainnet reference (testnet only). */`.

- [ ] **Step 4: Test and build**

Run: `cd web && npm test && npm run build`
Expected: all tests pass; the build (lint, type check, export, relayer guard) succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/reference/useMainnetReference.ts web/src/components/dashboard/MainnetReferenceCard.tsx web/src/components/dashboard/Dashboard.tsx
git commit -m "feat(web): mainnet reference card on the testnet dashboard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Agent QA and docs

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-f8-reference-card-quote-accuracy-design.md` (QA and quote-accuracy results)
- Modify: `PRODUCT_SPEC.md` (§16)
- Modify: `CLAUDE.md` (frontend notes)

- [ ] **Step 1: Serve the export and QA on testnet**

Serve `web/out` with `python3 -m http.server <port> --bind 127.0.0.1`, and restart it after every rebuild. In Playwright, use the keyless mock wallet from earlier QA (testnet account `0xe618B9B519Ee71a7e38D6f0c2e9479c573600D56`, chain `0x7b7b`). Check:
1. "Mainnet today" is the last dashboard card, with the badge and the dashed and muted style.
2. Its values match independent reads within the rounding shown:
   - `cast call` against `https://rpc-internal.mezo.org` for MUSD `totalSupply`, SP `getTotalMUSDDeposits`, and pool `getReserves`.
   - "LP fees, last 30 days" ≈0.12% (≈1.5% a year).
   - The SP row reads "No liquidations reached the pool".
3. History failure: abort historical `eth_call` requests to `rpc-internal.mezo.org` (JSON-RPC `eth_call` whose second param is a hex block). The 30-day rows read "Unavailable" and the head rows still show.
4. Head failure: abort every request to `rpc-internal.mezo.org`. The card reads "Mainnet data unavailable." with Retry, and the rest of the dashboard works. Remove the interceptor, click Retry, and the card fills.
5. Mainnet: switch the network (mock chain `0x7b7c`, account `0xDc887b3D44bdf789d60D2d427d5E8dB6e4ED6aD1`). The card is absent, and no request goes to the reference query.
6. At 360 px there is no horizontal scroll, and the two halves stack.

- [ ] **Step 2: Record results and update docs**

In the F8 spec:
- Append `### Quote-accuracy result (<date>)` with the summary JSON from Task 3 and one line per non-matching or skipped event.
- Append `### QA result (<date>): agent run passed` listing each QA check above with its figures, and any bug fixed on the way. Fix bugs with a failing test first, in separate `fix(web):` commits.

In `PRODUCT_SPEC.md` §16, add after the F6 "done" line:

```markdown
F8 done <date>: mainnet reference card on the testnet dashboard (pool reserves and value, swap fee, 30-day LP fees, Stability Pool deposits and share of MUSD supply, 30-day liquidations) read through its own mainnet client, and `npm run quote-accuracy` checking every executor `Entered` event against the quote engine (<N> checked, simulation exact, all within 1% slippage); design in `docs/superpowers/specs/2026-10-15-f8-reference-card-quote-accuracy-design.md`.
```

In `CLAUDE.md`, add a frontend bullet after "Route comparison (F6)":

```markdown
- Mainnet reference (F8): on testnet the dashboard ends with a "Mainnet today" card (`src/components/dashboard/MainnetReferenceCard.tsx`) read through its own viem client built from `networks.mainnet.rpcUrl`, because the wagmi config only knows the selected network. `NetworkConfig.rpcUrl` matches Passport's chains: testnet `rpc.test.mezo.org`, mainnet `rpc-internal.mezo.org`; viem's `mezo` chain points at `rpc.mezo.org`, which has no DNS record. The head figures and F6's 30-day history load side by side (`src/lib/reference/load.ts`): a failed head read fails the card, and a failed history read only blanks the 30-day rows. Quote accuracy: `npm run quote-accuracy` (testnet) or `QUOTE_NETWORK=mainnet npm run quote-accuracy` runs `scripts/live/quote-accuracy.live.ts` under `vitest.live.config.ts` (never in `npm test`). It replays every executor `Entered` event: the event's own swap must simulate to the wei, the optimal quote must land within 1% slippage, and an event is skipped when another transaction moved the pool earlier in its block. Design: `docs/superpowers/specs/2026-10-15-f8-reference-card-quote-accuracy-design.md`.
```

- [ ] **Step 3: Final verification**

Run: `cd web && npm test && npm run build && npm run quote-accuracy 2>&1 | tail -15 && cd ../contracts && forge fmt --check`
Expected: everything passes. `git status` shows no `* 2*` duplicates.

- [ ] **Step 4: Commit**

```bash
git add PRODUCT_SPEC.md CLAUDE.md docs/superpowers/specs/2026-10-15-f8-reference-card-quote-accuracy-design.md
git commit -m "docs: F8 QA, quote-accuracy result, and spec updates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
