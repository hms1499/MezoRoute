# F6 Route Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Compare routes" card on the connected dashboard shows the MUSD/BTC LP and the Stability Pool side by side for a typed MUSD amount. It covers return source, the last 30 days' on-chain results, a backtest of that amount, fee, position and BTC exposure after the deposit, the value after a 30% BTC drop, and risks, with "Choose" links that carry the amount to each route.

**Architecture:** The pure, unit-tested core lives in `web/src/lib/compare/`:
- `window.ts`: the history window maths.
- `lp-backtest.ts`: LP backtest from the pool fee indexes, reusing `quoteEntry`.
- `sp-backtest.ts`: Stability Pool backtest with Liquity v1 maths, checked to the wei against a live depositor.
- `comparison.ts`: per-amount comparison reusing `quoteEntry`, `afterEntry`, and the exposure module.
- `history.ts`: the two-block reads.
- `view.ts`: display strings.

Per-amount numbers come from the existing dashboard multicall, which gains the pool swap fee. The 30-day numbers come from archive `eth_call` at a block ≈30 days back and at the head (four RPC round trips, cached 10 minutes by TanStack Query). No event scans.

**Tech Stack:** Next.js 14.2.35 static export, React 18.3.1, wagmi 2.19.5, viem 2.57.2, TanStack Query (via wagmi), Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-15-f6-route-comparison-design.md`. Read it first; its chain facts and live numbers were verified on 15 Oct 2026. Flow B and FR-19 in `PRODUCT_SPEC.md` are the product requirement.

## Global Constraints

- **Branch and staging:** work on `feat/f6-route-comparison` in `/Users/vanhuy/Desktop/mezoroute`, with no worktree. Run `git branch --show-current` before each commit. Stage explicit paths. `git status` must show no `* 2*` iCloud duplicates.
- **Commits:** use the prefixes `feat(web):`, `fix(web):`, `test(web):`, `docs:`. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Scope:** no dependency changes, no contract changes. Addresses come only from `network.addresses`.
- **Units:** all amounts are `bigint`, with 1e18 = 1 MUSD = 1 BTC = 100%. Every division rounds down.
- **Copy:** English only. Never use "profit", "APY", "guaranteed", or "risk-free". Write the LP annual figure as "≈Y% a year, fees only". Never annualise the Stability Pool. Pre-transaction values are "≈" estimates. Footer: "Past results, not a forecast."
- **Rendering:** never let `WagmiProvider` re-render (see CLAUDE.md). The card renders inside the existing client-only dashboard tree.
- **Query keys:** TanStack Query keys must not contain a `bigint`.
- **Commands:** run `npm` from `web/`. UI tasks also run `npm run build` (lint and type check). Never build while `npm run dev` runs.

## Review Focus

- **RPC without archive state, or a past read that reverts:** the 30-day rows must fail on their own while the per-amount rows keep working. Pinned in Task 5 ("fetchRouteHistory rejects when a past read fails"); the UI split is checked in Task 8 QA.
- **A slow testnet RPC:** history must stop waiting and show Retry. Pinned in Task 5 (`withTimeout` rejects).
- **A huge amount (10,000,000 MUSD on a ≈100k MUSD mainnet pool):** no crash; price impact near 100% shows instead of a block. Pinned in Task 4.
- **"0", "0.0", "20,5", or 19 decimals typed:** zero is empty (no error), while a comma and over-precision get a message. Pinned in Task 6.
- **A history window that spans a Stability Pool scale or epoch change:** the deposit and gain must follow Liquity's rules, not plain division. Pinned in Task 3.

---

### Task 1: Dashboard snapshot reads the pool swap fee

**Files:**
- Modify: `web/src/lib/dashboard/snapshot.ts`
- Modify: `web/src/lib/dashboard/snapshot.test.ts`
- Modify: `web/src/lib/dashboard/test-fixtures.ts`
- Modify: `web/src/lib/routes/musd-btc-lp/snapshot.ts`
- Modify: `web/src/lib/routes/musd-btc-lp/snapshot.test.ts`
- Modify: `web/src/lib/routes/musd-btc-lp/test-fixtures.ts`
- Modify: `web/src/lib/stability-pool/snapshot.test.ts`

**Interfaces:**
- Produces:
  - `DashboardSnapshot.poolFeeBps: bigint`, the swap fee in bps from `PoolFactory.getFee(pool, false)`, read in the same multicall.
  - `DASHBOARD_READS = 13`.
  - `snapshotWith()` defaults `poolFeeBps` to `30n`.

- [ ] **Step 1: Update the dashboard snapshot tests (they fail first)**

In `web/src/lib/dashboard/snapshot.test.ts`:
- Append `30n,` as the last element of the array returned by `raw(...)`, after `20_000_000_000_000n,`.
- Change `expect(calls).toHaveLength(12);` to `expect(calls).toHaveLength(13);`.
- Replace the "asks about the connected account" test with:

```ts
  it("asks about the connected account in every per-user read", () => {
    const network = networks.testnet;
    const withArgs = snapshotContracts(network, ACCOUNT).filter(
      (call) => "args" in call && call.address !== network.addresses.poolFactory,
    );
    expect(withArgs).toHaveLength(7);
    for (const call of withArgs) expect("args" in call && call.args[0]).toBe(ACCOUNT);
  });

  it("reads the pool's swap fee from the factory, last", () => {
    for (const network of [networks.testnet, networks.mainnet]) {
      const calls = snapshotContracts(network, ACCOUNT);
      expect(calls[calls.length - 1]).toMatchObject({
        address: network.addresses.poolFactory,
        functionName: "getFee",
        args: [network.addresses.pool, false],
      });
    }
  });
```

- In the `"parses an active Trove…"` expectation object, add `poolFeeBps: 30n,` after the `sp:` line.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `cd web && npx vitest run src/lib/dashboard/snapshot.test.ts`
Expected: FAIL. The length is 12 instead of 13, there is no `getFee` call, and `poolFeeBps` is missing.

- [ ] **Step 3: Add the read to the dashboard snapshot**

In `web/src/lib/dashboard/snapshot.ts`:
- Change the import to `import { poolAbi, poolFactoryAbi } from "@/lib/abi/pool";`.
- Add `poolFeeBps: bigint; // the pool's swap fee in bps (PoolFactory.getFee)` to `DashboardSnapshot`, after `sp: SpPosition;`.
- Append `poolFeeBps: bigint,` to `SnapshotResults`, after `spBtcGain: bigint,`.
- Append to the array in `snapshotContracts`, after the `getDepositorCollateralGain` entry:

```ts
    { chainId, address: a.poolFactory, abi: poolFactoryAbi, functionName: "getFee", args: [a.pool, false] },
```

- In `parseSnapshot`, add `poolFeeBps` to the end of the destructuring list and `poolFeeBps,` after the `sp:` line of the returned object.

In `web/src/lib/dashboard/test-fixtures.ts`, add `poolFeeBps: 30n,` to `snapshotWith`'s object, after the `sp:` line.

- [ ] **Step 4: Make the LP route snapshot reuse it**

In `web/src/lib/routes/musd-btc-lp/snapshot.ts`:
- Remove the `import { poolFactoryAbi } from "@/lib/abi/pool";` line.
- Set `export const DASHBOARD_READS = 13;`.
- Delete `poolFeeBps: bigint,` from `LpRouteTail`.
- Delete the `getFee` entry from `lpRouteContracts`.
- In `parseLpRouteSnapshot`, delete `poolFeeBps,` from the tail destructuring and set `feeBps: dashboard.poolFeeBps,` in `pool`.

In `web/src/lib/routes/musd-btc-lp/snapshot.test.ts`:
- In `results(...)`, append `4n,` to the `dashboard` array, after the last `0n,`.
- Delete the first element of the returned tail (the `4n,` line right after `...dashboard,`).
- Change `DASHBOARD_READS + 12` to `DASHBOARD_READS + 11`.

In `web/src/lib/routes/musd-btc-lp/test-fixtures.ts`, add `poolFeeBps: TESTNET_POOL.feeBps,` inside the `snapshotWith({...})` call of `lpRouteSnapshotWith`, after the `lp:` line.

In `web/src/lib/stability-pool/snapshot.test.ts`:
- Append `30n,` to `dashboardResults`, after `7n,`.
- Change `toHaveLength(15)` to `toHaveLength(16)`.
- Change `contracts[12]`, `contracts[13]`, and `contracts[14]` to `contracts[13]`, `contracts[14]`, and `contracts[15]`.

- [ ] **Step 5: Run the whole suite and the type check**

Run: `cd web && npm test && npx tsc --noEmit`
Expected: PASS, with no type errors. If `tsc` reports a `DashboardSnapshot` literal missing `poolFeeBps`, add `poolFeeBps: 30n` there; it is a test fixture.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/dashboard/snapshot.ts web/src/lib/dashboard/snapshot.test.ts web/src/lib/dashboard/test-fixtures.ts web/src/lib/routes/musd-btc-lp/snapshot.ts web/src/lib/routes/musd-btc-lp/snapshot.test.ts web/src/lib/routes/musd-btc-lp/test-fixtures.ts web/src/lib/stability-pool/snapshot.test.ts
git commit -m "feat(web): read the pool swap fee in the dashboard snapshot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: History window and LP backtest

**Files:**
- Create: `web/src/lib/compare/window.ts`
- Create: `web/src/lib/compare/window.test.ts`
- Create: `web/src/lib/compare/test-fixtures.ts`
- Create: `web/src/lib/compare/lp-backtest.ts`
- Create: `web/src/lib/compare/lp-backtest.test.ts`

**Interfaces:**
- Consumes: `quoteEntry(pool: PoolState, musdIn: bigint, executorFeeBps: bigint): EntryQuote | null` and `PoolState` from `@/lib/quote/entry`; `WAD` from `@/lib/math`.
- Produces:
  - `REF_SPAN = 100_000n`.
  - `pastBlock(head: bigint, headTime: bigint, refTime: bigint): bigint`.
  - `annualise(ratio: bigint, seconds: bigint): bigint`.
  - `type PoolPoint = PoolState & { indexMusd: bigint; indexBtc: bigint }`.
  - `type LpBacktest = { liquidity; feesMusd; feesBtc; feesValue; valueNow; feeReturn; feeRate }` (all `bigint`).
  - `lpBacktest(input: { past: PoolPoint; now: PoolPoint; price: bigint; amount: bigint; executorFeeBps: bigint; seconds: bigint }): LpBacktest | null`.
  - Fixtures: `MAINNET_POOL_PAST`, `MAINNET_POOL_NOW`, `MAINNET_PRICE_NOW`, `MAINNET_PAST_TIME`, `MAINNET_HEAD_TIME`, `MAINNET_SECONDS`, `MAINNET_SP_PAST`, `MAINNET_SP_NOW`.

- [ ] **Step 1: Write the fixtures (live mainnet reads)**

Create `web/src/lib/compare/test-fixtures.ts`:

```ts
import { WAD } from "@/lib/math";
import type { PoolPoint } from "./lp-backtest";
import type { SpNow, SpPast } from "./sp-backtest";

// Test data only: mainnet reads with `cast` on 15 Oct 2026 at blocks 11,878,862 (past) and 12,518,862 (head).
// The pool's token0 is BTC on mainnet, so index0 is the BTC index and index1 the MUSD index.

export const ONE = WAD;

export const MAINNET_PAST_BLOCK = 11_878_862n;
export const MAINNET_HEAD_BLOCK = 12_518_862n;
export const MAINNET_PAST_TIME = 1_789_528_999n; // 16 Sep 2026 03:23:19 UTC
export const MAINNET_HEAD_TIME = 1_792_028_137n;
export const MAINNET_SECONDS = MAINNET_HEAD_TIME - MAINNET_PAST_TIME; // 2,499,138 s ≈ 28.9 days

export const MAINNET_POOL_PAST: PoolPoint = {
  reserveMusd: 190_904_600_985_487_322_454_909n,
  reserveBtc: 2_482_087_059_314_586_149n,
  totalSupply: 688_361_624_851_218_501_332n,
  feeBps: 30n,
  indexMusd: 19_546_743_927_044_764_245n,
  indexBtc: 198_933_653_530_832n,
};

export const MAINNET_POOL_NOW: PoolPoint = {
  reserveMusd: 102_550_926_417_461_780_755_855n,
  reserveBtc: 1_242_190_951_629_082_119n,
  totalSupply: 356_914_278_883_031_761_432n,
  feeBps: 30n,
  indexMusd: 19_911_507_212_486_742_590n,
  indexBtc: 202_966_274_473_322n,
};

export const MAINNET_PRICE_NOW = 81_669_799_990_000_000_000_000n;

const MAINNET_P = 945_105_103_840_338_372n;
const MAINNET_S = 819_121_711_620_961_369_568_223_825_678n;

/** No liquidation reached the mainnet Stability Pool between the two blocks. */
export const MAINNET_SP_PAST: SpPast = { P: MAINNET_P, S: MAINNET_S, epoch: 0n, scale: 0n };
export const MAINNET_SP_NOW: SpNow = { P: MAINNET_P, epoch: 0n, scale: 0n, sumAtPastScale: MAINNET_S, sumAtNextScale: 0n };
```

(The `SpPast`/`SpNow` imports resolve in Task 3. Until then, run only the test files named in each step; `tsc` over the whole project waits for Task 3.)

- [ ] **Step 2: Write the failing window tests**

Create `web/src/lib/compare/window.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { annualise, pastBlock, REF_SPAN } from "./window";

describe("pastBlock", () => {
  it("steps back 30 days at the average block time of the last REF_SPAN blocks", () => {
    // 3.922 s per block: 2,592,000 s × 100,000 / 392,200 s = 660,887 blocks (rounded down).
    expect(REF_SPAN).toBe(100_000n);
    expect(pastBlock(12_518_862n, 1_792_028_137n, 1_792_028_137n - 392_200n)).toBe(11_857_975n);
  });

  it("rejects timestamps that do not increase", () => {
    expect(() => pastBlock(12_518_862n, 1_000n, 1_000n)).toThrow();
  });

  it("rejects a chain younger than the window", () => {
    expect(() => pastBlock(500_000n, 1_000_000n, 1_000_000n - 1_000n)).toThrow();
  });
});

describe("annualise", () => {
  it("scales a ratio to 365 days, simple and rounded down", () => {
    expect(annualise(10n ** 15n, 2_499_138n)).toBe(12_618_750_945_325_948n);
  });

  it("rejects an empty window", () => {
    expect(() => annualise(1n, 0n)).toThrow();
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `cd web && npx vitest run src/lib/compare/window.test.ts`
Expected: FAIL with "Failed to resolve import "./window"".

- [ ] **Step 4: Implement `window.ts`**

Create `web/src/lib/compare/window.ts`:

```ts
const DAY = 86_400n;
/** The comparison looks back this far (spec F6). */
export const HISTORY_SECONDS = 30n * DAY;
const YEAR = 365n * DAY;
/** Blocks used to measure the recent average block time. */
export const REF_SPAN = 100_000n;

/**
 * The block ≈30 days before `head`, from the average block time over the last REF_SPAN blocks
 * (`refTime` is the timestamp of `head − REF_SPAN`). Block times differ by network and drift, so
 * the caller reads the chosen block's real timestamp and reports that window.
 */
export function pastBlock(head: bigint, headTime: bigint, refTime: bigint): bigint {
  const elapsed = headTime - refTime;
  if (elapsed <= 0n) throw new Error("Block timestamps do not increase");
  const back = (HISTORY_SECONDS * REF_SPAN) / elapsed;
  if (back >= head) throw new Error("The chain is younger than the history window");
  return head - back;
}

/** A 1e18 ratio earned over `seconds`, as a simple yearly rate (no compounding), rounded down. */
export function annualise(ratio: bigint, seconds: bigint): bigint {
  if (seconds <= 0n) throw new Error("Empty history window");
  return (ratio * YEAR) / seconds;
}
```

- [ ] **Step 5: Run the window tests**

Run: `cd web && npx vitest run src/lib/compare/window.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Write the failing LP backtest tests**

Create `web/src/lib/compare/lp-backtest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { WAD } from "@/lib/math";
import { quoteEntry } from "@/lib/quote/entry";
import { lpBacktest } from "./lp-backtest";
import { MAINNET_POOL_NOW, MAINNET_POOL_PAST, MAINNET_PRICE_NOW, MAINNET_SECONDS, ONE } from "./test-fixtures";

const AMOUNT = 1_000n * ONE;
const live = (executorFeeBps = 0n) =>
  lpBacktest({
    past: MAINNET_POOL_PAST,
    now: MAINNET_POOL_NOW,
    price: MAINNET_PRICE_NOW,
    amount: AMOUNT,
    executorFeeBps,
    seconds: MAINNET_SECONDS,
  });

describe("lpBacktest", () => {
  it("enters at the past pool state exactly as the executor would", () => {
    expect(live()?.liquidity).toBe(quoteEntry(MAINNET_POOL_PAST, AMOUNT, 0n)?.liquidity);
  });

  it("earns the fee index growth on its LP, token by token", () => {
    const result = live()!;
    const { indexMusd: musd0, indexBtc: btc0 } = MAINNET_POOL_PAST;
    const { indexMusd: musd1, indexBtc: btc1 } = MAINNET_POOL_NOW;
    expect(result.feesMusd).toBe((result.liquidity * (musd1 - musd0)) / WAD);
    expect(result.feesBtc).toBe((result.liquidity * (btc1 - btc0)) / WAD);
    expect(result.feesValue).toBe(result.feesMusd + (result.feesBtc * MAINNET_PRICE_NOW) / WAD);
  });

  it("matches the live mainnet window: ≈0.12% fees in 29 days, ≈1.6% a year", () => {
    const result = live()!;
    expect(result.feeReturn).toBeGreaterThan(1_200_000_000_000_000n); // 0.12%
    expect(result.feeReturn).toBeLessThan(1_300_000_000_000_000n); // 0.13%
    expect(result.feeRate).toBeGreaterThan(15_000_000_000_000_000n); // 1.5%
    expect(result.feeRate).toBeLessThan(16_500_000_000_000_000n); // 1.65%
    // BTC rose ≈7% over the window, so the position (half BTC) is worth ≈3% more, fees included.
    expect(result.valueNow).toBeGreaterThan(1_020n * ONE);
    expect(result.valueNow).toBeLessThan(1_040n * ONE);
  });

  it("values today's share of the pool plus fees and refunds at today's price", () => {
    const result = live()!;
    const quote = quoteEntry(MAINNET_POOL_PAST, AMOUNT, 0n)!;
    const musd = (result.liquidity * MAINNET_POOL_NOW.reserveMusd) / MAINNET_POOL_NOW.totalSupply;
    const btc = (result.liquidity * MAINNET_POOL_NOW.reserveBtc) / MAINNET_POOL_NOW.totalSupply;
    expect(result.valueNow).toBe(
      musd + quote.musdRefund + result.feesMusd + ((btc + result.feesBtc + quote.btcRefund) * MAINNET_PRICE_NOW) / WAD,
    );
  });

  it("earns nothing without swaps, and loses only the entry costs", () => {
    const midPrice = (MAINNET_POOL_PAST.reserveMusd * WAD) / MAINNET_POOL_PAST.reserveBtc;
    const result = lpBacktest({
      past: MAINNET_POOL_PAST,
      now: MAINNET_POOL_PAST,
      price: midPrice,
      amount: AMOUNT,
      executorFeeBps: 0n,
      seconds: MAINNET_SECONDS,
    })!;
    expect(result.feesValue).toBe(0n);
    expect(result.feeReturn).toBe(0n);
    expect(result.feeRate).toBe(0n);
    expect(result.valueNow).toBeLessThan(AMOUNT);
    expect(result.valueNow).toBeGreaterThan((AMOUNT * 99n) / 100n);
  });

  it("charges the executor fee before entering", () => {
    expect(live(10n)!.liquidity).toBeLessThan(live(0n)!.liquidity);
  });

  it("returns null for an empty pool", () => {
    const empty = { ...MAINNET_POOL_PAST, reserveMusd: 0n, reserveBtc: 0n, totalSupply: 0n };
    expect(
      lpBacktest({ past: empty, now: MAINNET_POOL_NOW, price: MAINNET_PRICE_NOW, amount: AMOUNT, executorFeeBps: 0n, seconds: 1n }),
    ).toBeNull();
  });
});
```

- [ ] **Step 7: Run them and watch them fail**

Run: `cd web && npx vitest run src/lib/compare/lp-backtest.test.ts`
Expected: FAIL with "Failed to resolve import "./lp-backtest"".

- [ ] **Step 8: Implement `lp-backtest.ts`**

Create `web/src/lib/compare/lp-backtest.ts`:

```ts
import { WAD } from "@/lib/math";
import { quoteEntry, type PoolState } from "@/lib/quote/entry";
import { annualise } from "./window";

/**
 * The pool at one block: the quote's state plus the fee indexes, mapped by token. An index is the
 * token amount one LP token (1e18) has earned since the pool began (Pool._update0/_update1).
 */
export type PoolPoint = PoolState & { indexMusd: bigint; indexBtc: bigint };

export type LpBacktest = {
  liquidity: bigint; // LP the amount would have received at the past block
  feesMusd: bigint;
  feesBtc: bigint;
  feesValue: bigint; // MUSD at today's price
  valueNow: bigint; // MUSD: today's pool share + entry refunds + fees, BTC at today's price
  feeReturn: bigint; // feesValue / amount, 1e18 = 100%
  feeRate: bigint; // feeReturn as a simple yearly rate
};

/**
 * What `amount` MUSD entered at `past` would be worth at `now` (spec F6 §1). An unstaked LP token
 * earns exactly the index growth, so the fees need no event scan. Null for an empty pool.
 */
export function lpBacktest(input: {
  past: PoolPoint;
  now: PoolPoint;
  price: bigint;
  amount: bigint;
  executorFeeBps: bigint;
  seconds: bigint;
}): LpBacktest | null {
  const { past, now, price, amount } = input;
  const quote = quoteEntry(past, amount, input.executorFeeBps);
  if (quote === null || now.totalSupply === 0n) return null;
  const { liquidity } = quote;
  const feesMusd = (liquidity * (now.indexMusd - past.indexMusd)) / WAD;
  const feesBtc = (liquidity * (now.indexBtc - past.indexBtc)) / WAD;
  const feesValue = feesMusd + (feesBtc * price) / WAD;
  const musdNow = (liquidity * now.reserveMusd) / now.totalSupply;
  const btcNow = (liquidity * now.reserveBtc) / now.totalSupply;
  const valueNow = musdNow + quote.musdRefund + feesMusd + ((btcNow + feesBtc + quote.btcRefund) * price) / WAD;
  const feeReturn = (feesValue * WAD) / amount;
  return { liquidity, feesMusd, feesBtc, feesValue, valueNow, feeReturn, feeRate: annualise(feeReturn, input.seconds) };
}
```

- [ ] **Step 9: Run the LP backtest tests**

Run: `cd web && npx vitest run src/lib/compare/lp-backtest.test.ts src/lib/compare/window.test.ts`
Expected: PASS. (Vitest strips types, so the fixture's `SpPast`/`SpNow` type import does not need to resolve yet.)

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/compare/window.ts web/src/lib/compare/window.test.ts web/src/lib/compare/test-fixtures.ts web/src/lib/compare/lp-backtest.ts web/src/lib/compare/lp-backtest.test.ts
git commit -m "feat(web): LP backtest from the pool fee indexes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Stability Pool backtest (Liquity v1 maths)

**Files:**
- Create: `web/src/lib/compare/sp-backtest.ts`
- Create: `web/src/lib/compare/sp-backtest.test.ts`

**Interfaces:**
- Consumes: `WAD` from `@/lib/math`; fixtures `MAINNET_SP_PAST`, `MAINNET_SP_NOW`, `MAINNET_PRICE_NOW`, `ONE` from Task 2.
- Produces:
  - `SCALE_FACTOR = 10n ** 9n`.
  - `type SpPast = { P: bigint; S: bigint; epoch: bigint; scale: bigint }`.
  - `type SpNow = { P: bigint; epoch: bigint; scale: bigint; sumAtPastScale: bigint; sumAtNextScale: bigint }`.
  - `type SpBacktest = { depositNow; btcGain; valueNow; gainReturn; lossReturn: bigint; liquidated: boolean }`.
  - `spBacktest(input: { past: SpPast; now: SpNow; price: bigint; amount: bigint }): SpBacktest`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/compare/sp-backtest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { spBacktest, type SpNow, type SpPast } from "./sp-backtest";
import { MAINNET_PRICE_NOW, MAINNET_SP_NOW, MAINNET_SP_PAST, ONE } from "./test-fixtures";

const FRESH: SpPast = { P: ONE, S: 0n, epoch: 0n, scale: 0n };
const now = (overrides: Partial<SpNow>): SpNow => ({
  P: ONE,
  epoch: 0n,
  scale: 0n,
  sumAtPastScale: 0n,
  sumAtNextScale: 0n,
  ...overrides,
});

describe("spBacktest", () => {
  it("matches the live testnet pool to the wei (depositor 0x4ddd…6b80af, block 16,164,226)", () => {
    const result = spBacktest({
      past: FRESH,
      now: now({ P: 862_311_608_208_321_926n, sumAtPastScale: 1_762_242_400_191_991_938_652_754_983_974n }),
      price: 0n,
      amount: 10n ** 26n,
    });
    expect(result.depositNow).toBe(86_231_160_820_832_192_600_000_000n); // getCompoundedMUSDDeposit
    expect(result.btcGain).toBe(176_224_240_019_199_193_865n); // getDepositorCollateralGain
    expect(result.liquidated).toBe(true);
  });

  it("returns the deposit unchanged when no liquidation reached the pool (mainnet, last 30 days)", () => {
    const result = spBacktest({ past: MAINNET_SP_PAST, now: MAINNET_SP_NOW, price: MAINNET_PRICE_NOW, amount: 1_000n * ONE });
    expect(result).toEqual({
      depositNow: 1_000n * ONE,
      btcGain: 0n,
      valueNow: 1_000n * ONE,
      gainReturn: 0n,
      lossReturn: 0n,
      liquidated: false,
    });
  });

  it("absorbs debt and earns BTC within one scale", () => {
    // The pool held 1,000 MUSD; a liquidation offset 100 MUSD of debt for 0.002 BTC.
    const result = spBacktest({
      past: FRESH,
      now: now({ P: 900_000_000_000_000_000n, sumAtPastScale: 2n * 10n ** 30n }),
      price: 80_000n * ONE,
      amount: 1_000n * ONE,
    });
    expect(result.depositNow).toBe(900n * ONE);
    expect(result.btcGain).toBe(2_000_000_000_000_000n);
    expect(result.valueNow).toBe(1_060n * ONE); // 900 + 0.002 × 80,000
    expect(result.gainReturn).toBe(160_000_000_000_000_000n); // 16%
    expect(result.lossReturn).toBe(100_000_000_000_000_000n); // 10%
  });

  it("follows a scale change: the deposit divides by SCALE_FACTOR and the next scale's sum counts", () => {
    const result = spBacktest({
      past: { P: 4_000_000_000n, S: 0n, epoch: 0n, scale: 0n },
      now: now({ P: ONE, scale: 1n, sumAtPastScale: 4n * 10n ** 21n, sumAtNextScale: 2n * 10n ** 30n }),
      price: 0n,
      amount: 1_000n * ONE,
    });
    expect(result.depositNow).toBe(250n * ONE);
    expect(result.btcGain).toBe(1_500_000_000_000_000n);
  });

  it("empties the deposit after more than one scale change", () => {
    const result = spBacktest({ past: FRESH, now: now({ scale: 2n }), price: 0n, amount: 1_000n * ONE });
    expect(result.depositNow).toBe(0n);
  });

  it("empties the deposit after an epoch change but keeps the old epoch's gain", () => {
    const result = spBacktest({
      past: FRESH,
      now: now({ epoch: 1n, sumAtPastScale: 2n * 10n ** 30n }),
      price: 0n,
      amount: 1_000n * ONE,
    });
    expect(result.depositNow).toBe(0n);
    expect(result.btcGain).toBe(2_000_000_000_000_000n);
    expect(result.liquidated).toBe(true);
  });

  it("treats a deposit below amount / 1e9 as gone, like the contract", () => {
    const result = spBacktest({ past: FRESH, now: now({ P: 500_000_000n }), price: 0n, amount: 1_000n * ONE });
    expect(result.depositNow).toBe(0n);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd web && npx vitest run src/lib/compare/sp-backtest.test.ts`
Expected: FAIL with "Failed to resolve import "./sp-backtest"".

- [ ] **Step 3: Implement `sp-backtest.ts`**

Create `web/src/lib/compare/sp-backtest.ts`:

```ts
import { WAD } from "@/lib/math";

/** StabilityPool.SCALE_FACTOR on Mezo (read on mainnet, 15 Oct 2026). */
export const SCALE_FACTOR = 10n ** 9n;

/** A deposit's snapshot at the past block: the pool's running product P, sum S, epoch, and scale. */
export type SpPast = { P: bigint; S: bigint; epoch: bigint; scale: bigint };
/** The pool today, with the sums at the past snapshot's scale and the next one. */
export type SpNow = { P: bigint; epoch: bigint; scale: bigint; sumAtPastScale: bigint; sumAtNextScale: bigint };

export type SpBacktest = {
  depositNow: bigint; // compounded deposit, MUSD
  btcGain: bigint;
  valueNow: bigint; // MUSD: depositNow + btcGain at today's price
  gainReturn: bigint; // BTC gain value / amount, 1e18 = 100%
  lossReturn: bigint; // debt absorbed / amount
  liquidated: boolean; // a liquidation reached the pool in the window
};

/**
 * What `amount` MUSD deposited at the past block would be today: Liquity v1's
 * getCompoundedStakeFromSnapshots and getDepositorCollateralGain (spec F6 §1), all divisions rounding down.
 */
export function spBacktest(input: { past: SpPast; now: SpNow; price: bigint; amount: bigint }): SpBacktest {
  const { past, now, price, amount } = input;
  const firstPortion = now.sumAtPastScale - past.S;
  const secondPortion = now.sumAtNextScale / SCALE_FACTOR;
  const btcGain = (amount * (firstPortion + secondPortion)) / past.P / WAD;
  const depositNow = compounded(amount, past, now);
  const gainValue = (btcGain * price) / WAD;
  return {
    depositNow,
    btcGain,
    valueNow: depositNow + gainValue,
    gainReturn: (gainValue * WAD) / amount,
    lossReturn: ((amount - depositNow) * WAD) / amount,
    liquidated:
      now.P !== past.P || now.epoch !== past.epoch || now.scale !== past.scale || firstPortion !== 0n || secondPortion !== 0n,
  };
}

function compounded(amount: bigint, past: SpPast, now: SpNow): bigint {
  if (now.epoch > past.epoch) return 0n; // the pool was emptied since the snapshot
  const scaleDiff = now.scale - past.scale;
  let value: bigint;
  if (scaleDiff === 0n) value = (amount * now.P) / past.P;
  else if (scaleDiff === 1n) value = (amount * now.P) / past.P / SCALE_FACTOR;
  else return 0n;
  return value < amount / SCALE_FACTOR ? 0n : value;
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `cd web && npx vitest run src/lib/compare && npx tsc --noEmit`
Expected: PASS, with no type errors (the Task 2 fixture types now resolve).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/compare/sp-backtest.ts web/src/lib/compare/sp-backtest.test.ts
git commit -m "feat(web): Stability Pool backtest with Liquity v1 maths, checked against a live depositor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Per-amount route comparison

**Files:**
- Modify: `web/src/lib/exposure/exposure.ts` (extract `lpValueAfterDrop`)
- Modify: `web/src/lib/exposure/exposure.test.ts`
- Create: `web/src/lib/stability-pool/after-deposit.ts`
- Modify: `web/src/lib/stability-pool/preview.ts` (use `afterSpDeposit`)
- Create: `web/src/lib/compare/comparison.ts`
- Create: `web/src/lib/compare/comparison.test.ts`

**Interfaces:**
- Consumes:
  - `DashboardSnapshot` with `poolFeeBps` (Task 1).
  - `quoteEntry` from `@/lib/quote/entry`.
  - `afterEntry(snapshot, quote)` from `@/lib/routes/musd-btc-lp/after-entry`.
  - `exposure(snapshot): Exposure` and `type Drawdown = 10 | 20 | 30` from `@/lib/exposure/exposure`.
- Produces:
  - `lpValueAfterDrop(value: bigint, dropPercent: Drawdown): bigint`.
  - `afterSpDeposit(snapshot: DashboardSnapshot, musdIn: bigint): DashboardSnapshot`.
  - `STRESS_DROP: Drawdown = 30`.
  - `type LpComparison = { status: "ok"; fee; priceImpact; positionValue; btcBefore; btcAfter; valueAfterDrop: bigint } | { status: "unavailable" }`.
  - `type SpComparison = { positionValue; btcBefore; btcAfter; valueAfterDrop: bigint }`.
  - `type ComparedRoutes = { amount: bigint; overBalance: boolean; lp: LpComparison; sp: SpComparison }`.
  - `compareRoutes(input: { snapshot: DashboardSnapshot; amount: bigint; executorFeeBps: bigint | null }): ComparedRoutes`.

- [ ] **Step 1: Write the failing tests**

Add to `web/src/lib/exposure/exposure.test.ts`:
- Change the import to `import { drawdownScenarios, exposure, lpValueAfterDrop } from "./exposure";`.
- Append:

```ts
describe("lpValueAfterDrop", () => {
  it("scales a constant-product LP value with the square root of the price ratio", () => {
    // √0.7 = 0.836660026534075547…; 1,000 MUSD → 836.660026534075547 MUSD (rounded down).
    expect(lpValueAfterDrop(1_000n * 10n ** 18n, 30)).toBe(836_660_026_534_075_547_000n);
    expect(lpValueAfterDrop(0n, 30)).toBe(0n);
  });
});
```

Create `web/src/lib/compare/comparison.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { snapshotWith, spPosition } from "@/lib/dashboard/test-fixtures";
import { exposure, lpValueAfterDrop } from "@/lib/exposure/exposure";
import { WAD } from "@/lib/math";
import { quoteEntry } from "@/lib/quote/entry";
import { TESTNET_POOL } from "@/lib/routes/musd-btc-lp/test-fixtures";
import { compareRoutes } from "./comparison";

const ONE = WAD;
const POOL_PRICE = (TESTNET_POOL.reserveMusd * WAD) / TESTNET_POOL.reserveBtc; // ≈78,759 MUSD per BTC
const snapshot = snapshotWith({
  price: POOL_PRICE,
  musd: 500n * ONE,
  poolFeeBps: TESTNET_POOL.feeBps,
  lp: { balance: 0n, totalSupply: TESTNET_POOL.totalSupply, reserveMusd: TESTNET_POOL.reserveMusd, reserveBtc: TESTNET_POOL.reserveBtc },
  sp: spPosition,
});

describe("compareRoutes", () => {
  it("quotes the LP side like the LP route: executor fee, price impact, new share value", () => {
    const result = compareRoutes({ snapshot, amount: 20n * ONE, executorFeeBps: 10n });
    const quote = quoteEntry(TESTNET_POOL, 20n * ONE, 10n)!;
    if (result.lp.status !== "ok") throw new Error("expected a quote");
    expect(result.lp.fee).toBe(20_000_000_000_000_000n); // 0.1% of 20 MUSD
    expect(result.lp.priceImpact).toBe(quote.priceImpact);
    expect(result.lp.positionValue).toBeLessThan(20n * ONE);
    expect(result.lp.positionValue).toBeGreaterThan((20n * ONE * 99n) / 100n);
    expect(result.lp.valueAfterDrop).toBe(lpValueAfterDrop(result.lp.positionValue, 30));
  });

  it("adds about half the amount to BTC exposure on the LP side", () => {
    const result = compareRoutes({ snapshot, amount: 20n * ONE, executorFeeBps: 10n });
    if (result.lp.status !== "ok") throw new Error("expected a quote");
    const before = exposure(snapshot).totalBtc;
    const halfInBtc = (10n * ONE * WAD) / POOL_PRICE;
    expect(result.lp.btcBefore).toBe(before);
    expect(result.lp.btcAfter - before).toBeGreaterThan((halfInBtc * 98n) / 100n);
    expect(result.lp.btcAfter - before).toBeLessThan(halfInBtc);
  });

  it("quotes with no executor fee when the network has no executor (mainnet before M1)", () => {
    const result = compareRoutes({ snapshot, amount: 20n * ONE, executorFeeBps: null });
    expect(result.lp.status === "ok" && result.lp.fee).toBe(0n);
  });

  it("keeps the Stability Pool side in MUSD; the deposit pays the pending gain to the wallet", () => {
    const result = compareRoutes({ snapshot, amount: 20n * ONE, executorFeeBps: 10n });
    expect(result.sp.positionValue).toBe(20n * ONE);
    expect(result.sp.valueAfterDrop).toBe(20n * ONE);
    expect(result.sp.btcBefore).toBe(exposure(snapshot).totalBtc);
    expect(result.sp.btcAfter).toBe(exposure(snapshot).totalBtc - spPosition.btcGain);
  });

  it("flags an amount above the wallet balance without blocking the comparison", () => {
    expect(compareRoutes({ snapshot, amount: 600n * ONE, executorFeeBps: 10n }).overBalance).toBe(true);
    expect(compareRoutes({ snapshot, amount: 500n * ONE, executorFeeBps: 10n }).overBalance).toBe(false);
  });

  it("still compares a huge amount, with the price impact showing the cost", () => {
    const result = compareRoutes({ snapshot, amount: 1_000_000_000n * ONE, executorFeeBps: 10n });
    if (result.lp.status !== "ok") throw new Error("expected a quote");
    expect(result.lp.priceImpact).toBeGreaterThan(WAD / 2n); // over 50%
    expect(result.lp.positionValue).toBeGreaterThan(0n);
  });

  it("marks the LP side unavailable for an empty pool", () => {
    const empty = snapshotWith({ lp: { balance: 0n, totalSupply: 0n, reserveMusd: 0n, reserveBtc: 0n } });
    expect(compareRoutes({ snapshot: empty, amount: 20n * ONE, executorFeeBps: 10n }).lp).toEqual({ status: "unavailable" });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd web && npx vitest run src/lib/exposure/exposure.test.ts src/lib/compare/comparison.test.ts`
Expected: FAIL. `lpValueAfterDrop` is not exported, and `./comparison` does not resolve.

- [ ] **Step 3: Extract `lpValueAfterDrop`**

In `web/src/lib/exposure/exposure.ts`, add above `drawdownScenarios`:

```ts
/** A constant-product LP's value after a BTC drop: it scales with √(price ratio). Rounds down. */
export function lpValueAfterDrop(value: bigint, dropPercent: Drawdown): bigint {
  const lpFactor = isqrt((BigInt(100 - dropPercent) * WAD * WAD) / 100n);
  return (value * lpFactor) / WAD;
}
```

In `drawdownScenarios`, delete the two lines `// A constant-product LP's value scales with √(price ratio).` and `const lpFactor = …;`. Then replace `lpValue: (current.lpValue * lpFactor) / WAD,` with `lpValue: lpValueAfterDrop(current.lpValue, dropPercent),`.

- [ ] **Step 4: Extract `afterSpDeposit`**

Create `web/src/lib/stability-pool/after-deposit.ts`:

```ts
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";

/** The dashboard snapshot after a Stability Pool deposit: provideToSP also pays the pending BTC gain to the wallet. */
export function afterSpDeposit(snapshot: DashboardSnapshot, musdIn: bigint): DashboardSnapshot {
  return { ...snapshot, musd: snapshot.musd - musdIn, sp: { deposit: snapshot.sp.deposit + musdIn, btcGain: 0n } };
}
```

In `web/src/lib/stability-pool/preview.ts`:
- Add `import { afterSpDeposit } from "./after-deposit";`.
- Replace the `after:` expression with:

```ts
    after: input.musdIn === null ? null : afterSpDeposit(dashboard, input.musdIn),
```

- [ ] **Step 5: Implement `comparison.ts`**

Create `web/src/lib/compare/comparison.ts`:

```ts
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { exposure, lpValueAfterDrop, type Drawdown } from "@/lib/exposure/exposure";
import { WAD } from "@/lib/math";
import { quoteEntry } from "@/lib/quote/entry";
import { afterEntry } from "@/lib/routes/musd-btc-lp/after-entry";
import { afterSpDeposit } from "@/lib/stability-pool/after-deposit";

/** The comparison's stress row: the new position after this BTC drop. */
export const STRESS_DROP: Drawdown = 30;

export type LpComparison =
  | {
      status: "ok";
      fee: bigint; // MezoRoute's execution fee, MUSD
      priceImpact: bigint; // 1e18 = 100%
      positionValue: bigint; // the new LP share at the oracle price, MUSD
      btcBefore: bigint;
      btcAfter: bigint;
      valueAfterDrop: bigint;
    }
  | { status: "unavailable" }; // empty pool: quoteEntry has nothing to quote

export type SpComparison = { positionValue: bigint; btcBefore: bigint; btcAfter: bigint; valueAfterDrop: bigint };

export type ComparedRoutes = { amount: bigint; overBalance: boolean; lp: LpComparison; sp: SpComparison };

/**
 * Both routes for one amount, from the dashboard snapshot (Flow B, FR-19). Without an executor
 * (mainnet before M1) the LP side quotes with no fee; the card says the fee is set at launch.
 */
export function compareRoutes(input: { snapshot: DashboardSnapshot; amount: bigint; executorFeeBps: bigint | null }): ComparedRoutes {
  const { snapshot, amount } = input;
  const btcBefore = exposure(snapshot).totalBtc;
  const pool = {
    reserveMusd: snapshot.lp.reserveMusd,
    reserveBtc: snapshot.lp.reserveBtc,
    totalSupply: snapshot.lp.totalSupply,
    feeBps: snapshot.poolFeeBps,
  };
  const quote = quoteEntry(pool, amount, input.executorFeeBps ?? 0n);
  let lp: LpComparison = { status: "unavailable" };
  if (quote) {
    const { after, liquidity } = quote;
    const shareMusd = (liquidity * after.reserveMusd) / after.totalSupply;
    const shareBtc = (liquidity * after.reserveBtc) / after.totalSupply;
    const positionValue = shareMusd + (shareBtc * snapshot.price) / WAD;
    lp = {
      status: "ok",
      fee: quote.fee,
      priceImpact: quote.priceImpact,
      positionValue,
      btcBefore,
      btcAfter: exposure(afterEntry(snapshot, quote)).totalBtc,
      valueAfterDrop: lpValueAfterDrop(positionValue, STRESS_DROP),
    };
  }
  return {
    amount,
    overBalance: amount > snapshot.musd,
    lp,
    sp: {
      positionValue: amount,
      btcBefore,
      btcAfter: exposure(afterSpDeposit(snapshot, amount)).totalBtc,
      valueAfterDrop: amount, // MUSD does not move with BTC; new liquidations are not modelled
    },
  };
}
```

- [ ] **Step 6: Run the suite**

Run: `cd web && npm test`
Expected: PASS. The existing `drawdownScenarios` and `spDepositPreview` tests still pass unchanged.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/exposure/exposure.ts web/src/lib/exposure/exposure.test.ts web/src/lib/stability-pool/after-deposit.ts web/src/lib/stability-pool/preview.ts web/src/lib/compare/comparison.ts web/src/lib/compare/comparison.test.ts
git commit -m "feat(web): compare the LP and Stability Pool routes for one amount

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Two-block history reads

**Files:**
- Modify: `web/src/lib/abi/musd.ts` (SP getters)
- Create: `web/src/lib/compare/history.ts`
- Create: `web/src/lib/compare/history.test.ts`

**Interfaces:**
- Consumes:
  - `PoolPoint` and `lpBacktest` (Task 2); `SpPast`, `SpNow`, and `spBacktest` (Task 3); `pastBlock` and `REF_SPAN` (Task 2).
  - `musdIsToken0(network)` from `@/lib/dashboard/snapshot`.
  - `poolAbi` and `poolFactoryAbi` from `@/lib/abi/pool`; `priceFeedAbi` and `stabilityPoolAbi` from `@/lib/abi/musd`.
- Produces:
  - `type RouteHistory = { pastBlock; pastTime; headBlock; headTime; price: bigint; pool: { past: PoolPoint; now: PoolPoint }; sp: { past: SpPast; now: SpNow } }`.
  - `type HistoryClient` (a minimal `getBlock` and `multicall` client).
  - `fetchRouteHistory(client: HistoryClient, network: NetworkConfig): Promise<RouteHistory>`.
  - `type RouteBacktests = { lp: LpBacktest | null; sp: SpBacktest; seconds; pastTime; pastBlock; headBlock: bigint }`.
  - `backtestRoutes(history: RouteHistory, amount: bigint, executorFeeBps: bigint): RouteBacktests`.
  - `withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>`.
  - `HISTORY_TIMEOUT_MS = 15_000`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/compare/history.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { backtestRoutes, fetchRouteHistory, withTimeout, type HistoryClient } from "./history";
import {
  MAINNET_HEAD_BLOCK,
  MAINNET_HEAD_TIME,
  MAINNET_PAST_TIME,
  MAINNET_POOL_NOW,
  MAINNET_POOL_PAST,
  MAINNET_PRICE_NOW,
  MAINNET_SP_NOW,
  MAINNET_SP_PAST,
  ONE,
} from "./test-fixtures";

const network = networks.mainnet; // token0 is BTC: index0 is the BTC index
const PAST = 11_857_975n; // pastBlock() for a 3.922 s average block time

const pastState = [
  MAINNET_POOL_PAST.indexBtc,
  MAINNET_POOL_PAST.indexMusd,
  [MAINNET_POOL_PAST.reserveBtc, MAINNET_POOL_PAST.reserveMusd, 1_789_515_029n],
  MAINNET_POOL_PAST.totalSupply,
  30n,
  MAINNET_SP_PAST.P,
  0n,
  0n,
];
const headState = [
  MAINNET_POOL_NOW.indexBtc,
  MAINNET_POOL_NOW.indexMusd,
  [MAINNET_POOL_NOW.reserveBtc, MAINNET_POOL_NOW.reserveMusd, 1_792_028_034n],
  MAINNET_POOL_NOW.totalSupply,
  30n,
  MAINNET_PRICE_NOW,
  MAINNET_SP_NOW.P,
  0n,
  0n,
  MAINNET_SP_NOW.sumAtPastScale,
  0n,
];

type Call = { blockNumber: bigint; names: string[]; args: unknown[]; multicallAddress: string };

function fakeClient(options: { failPast?: boolean } = {}) {
  const calls: Call[] = [];
  const client: HistoryClient = {
    async getBlock(args) {
      if (!args) return { number: MAINNET_HEAD_BLOCK, timestamp: MAINNET_HEAD_TIME };
      if (args.blockNumber === MAINNET_HEAD_BLOCK - 100_000n) return { number: args.blockNumber, timestamp: MAINNET_HEAD_TIME - 392_200n };
      if (args.blockNumber === PAST) return { number: PAST, timestamp: MAINNET_PAST_TIME };
      throw new Error(`unexpected block ${args.blockNumber}`);
    },
    async multicall({ contracts, blockNumber, multicallAddress }) {
      const list = contracts as { functionName: string; args?: unknown[] }[];
      calls.push({ blockNumber, names: list.map((c) => c.functionName), args: list.map((c) => c.args), multicallAddress });
      if (blockNumber === PAST && options.failPast) throw new Error("missing trie node");
      if (blockNumber === PAST && list.length === 8) return pastState;
      if (blockNumber === PAST && list.length === 1) return [MAINNET_SP_PAST.S];
      if (blockNumber === MAINNET_HEAD_BLOCK) return headState;
      throw new Error("unexpected multicall");
    },
  };
  return { client, calls };
}

describe("fetchRouteHistory", () => {
  it("reads the pool and Stability Pool at the past block and the head, mapped by token", async () => {
    const { client } = fakeClient();
    expect(await fetchRouteHistory(client, network)).toEqual({
      pastBlock: PAST,
      pastTime: MAINNET_PAST_TIME,
      headBlock: MAINNET_HEAD_BLOCK,
      headTime: MAINNET_HEAD_TIME,
      price: MAINNET_PRICE_NOW,
      pool: { past: MAINNET_POOL_PAST, now: MAINNET_POOL_NOW },
      sp: { past: MAINNET_SP_PAST, now: MAINNET_SP_NOW },
    });
  });

  it("asks for the sums at the past epoch and scale, and the next scale, through the network's Multicall3", async () => {
    const { client, calls } = fakeClient();
    await fetchRouteHistory(client, network);
    expect(calls.map((c) => c.blockNumber)).toEqual([PAST, PAST, MAINNET_HEAD_BLOCK]);
    expect(calls[1]).toMatchObject({ names: ["epochToScaleToSum"], args: [[0n, 0n]] });
    expect(calls[2].names.slice(-2)).toEqual(["epochToScaleToSum", "epochToScaleToSum"]);
    expect(calls[2].args.slice(-2)).toEqual([[0n, 0n], [0n, 1n]]);
    for (const call of calls) expect(call.multicallAddress).toBe(network.addresses.multicall3);
  });

  it("rejects when a past read fails (no archive state), so only the 30-day rows fail", async () => {
    const { client } = fakeClient({ failPast: true });
    await expect(fetchRouteHistory(client, network)).rejects.toThrow("missing trie node");
  });
});

describe("backtestRoutes", () => {
  it("backtests both routes over the real window", async () => {
    const { client } = fakeClient();
    const history = await fetchRouteHistory(client, network);
    const result = backtestRoutes(history, 1_000n * ONE, 0n);
    expect(result.seconds).toBe(MAINNET_HEAD_TIME - MAINNET_PAST_TIME);
    expect(result.pastTime).toBe(MAINNET_PAST_TIME);
    expect(result.lp?.feeReturn).toBeGreaterThan(0n);
    expect(result.sp).toMatchObject({ depositNow: 1_000n * ONE, liquidated: false });
  });
});

describe("withTimeout", () => {
  it("rejects a promise that takes too long", async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow("Timed out");
  });

  it("passes a value through", async () => {
    await expect(withTimeout(Promise.resolve(7), 1_000)).resolves.toBe(7);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd web && npx vitest run src/lib/compare/history.test.ts`
Expected: FAIL with "Failed to resolve import "./history"".

- [ ] **Step 3: Add the SP getters to the ABI**

In `web/src/lib/abi/musd.ts`, add these lines to `stabilityPoolAbi`'s `parseAbi([...])` list, after `"function deposits(address depositor) view returns (uint256)",`:

```ts
  "function P() view returns (uint256)",
  "function currentEpoch() view returns (uint128)",
  "function currentScale() view returns (uint128)",
  "function epochToScaleToSum(uint128 epoch, uint128 scale) view returns (uint256)",
```

- [ ] **Step 4: Implement `history.ts`**

Create `web/src/lib/compare/history.ts`:

```ts
import type { Address } from "viem";
import { priceFeedAbi, stabilityPoolAbi } from "@/lib/abi/musd";
import { poolAbi, poolFactoryAbi } from "@/lib/abi/pool";
import type { NetworkConfig } from "@/lib/config/networks";
import { musdIsToken0 } from "@/lib/dashboard/snapshot";
import { lpBacktest, type LpBacktest, type PoolPoint } from "./lp-backtest";
import { spBacktest, type SpBacktest, type SpNow, type SpPast } from "./sp-backtest";
import { pastBlock, REF_SPAN } from "./window";

export const HISTORY_TIMEOUT_MS = 15_000;

/** Both routes' state at the block ≈30 days back and at the head (spec F6 §2). */
export type RouteHistory = {
  pastBlock: bigint;
  pastTime: bigint;
  headBlock: bigint;
  headTime: bigint;
  price: bigint; // oracle price at the head
  pool: { past: PoolPoint; now: PoolPoint };
  sp: { past: SpPast; now: SpNow };
};

/** The two public-client calls the history needs; wagmi's public client satisfies it. */
export type HistoryClient = {
  getBlock(args?: { blockNumber: bigint }): Promise<{ number: bigint | null; timestamp: bigint }>;
  multicall(args: {
    contracts: readonly unknown[];
    blockNumber: bigint;
    allowFailure: false;
    multicallAddress: Address;
  }): Promise<readonly unknown[]>;
};

type PoolResults = readonly [index0: bigint, index1: bigint, reserves: readonly [bigint, bigint, bigint], totalSupply: bigint, feeBps: bigint];
const POOL_READS = 5;

function poolReads(network: NetworkConfig) {
  const a = network.addresses;
  return [
    { address: a.pool, abi: poolAbi, functionName: "index0" },
    { address: a.pool, abi: poolAbi, functionName: "index1" },
    { address: a.pool, abi: poolAbi, functionName: "getReserves" },
    { address: a.pool, abi: poolAbi, functionName: "totalSupply" },
    { address: a.poolFactory, abi: poolFactoryAbi, functionName: "getFee", args: [a.pool, false] },
  ] as const;
}

function spStateReads(network: NetworkConfig) {
  const sp = network.addresses.stabilityPool;
  return [
    { address: sp, abi: stabilityPoolAbi, functionName: "P" },
    { address: sp, abi: stabilityPoolAbi, functionName: "currentEpoch" },
    { address: sp, abi: stabilityPoolAbi, functionName: "currentScale" },
  ] as const;
}

function sumRead(network: NetworkConfig, epoch: bigint, scale: bigint) {
  return { address: network.addresses.stabilityPool, abi: stabilityPoolAbi, functionName: "epochToScaleToSum", args: [epoch, scale] } as const;
}

function parsePool(network: NetworkConfig, results: PoolResults): PoolPoint {
  const [index0, index1, reserves, totalSupply, feeBps] = results;
  const musdFirst = musdIsToken0(network);
  return {
    reserveMusd: musdFirst ? reserves[0] : reserves[1],
    reserveBtc: musdFirst ? reserves[1] : reserves[0],
    totalSupply,
    feeBps,
    indexMusd: musdFirst ? index0 : index1,
    indexBtc: musdFirst ? index1 : index0,
  };
}

/**
 * Four round trips: the head block; the block REF_SPAN back (for the average block time); the past
 * block's timestamp with the past state; then the past sum with the head state (both need the past
 * epoch and scale). Needs archive state; any failure rejects, and the card shows only the 30-day
 * rows as unavailable.
 */
export async function fetchRouteHistory(client: HistoryClient, network: NetworkConfig): Promise<RouteHistory> {
  const multicallAddress = network.addresses.multicall3;
  const head = await client.getBlock();
  if (head.number === null) throw new Error("The RPC returned a pending head block");
  const headBlock = head.number;
  const ref = await client.getBlock({ blockNumber: headBlock - REF_SPAN });
  const past = pastBlock(headBlock, head.timestamp, ref.timestamp);
  const [pastHeader, pastState] = await Promise.all([
    client.getBlock({ blockNumber: past }),
    client.multicall({
      contracts: [...poolReads(network), ...spStateReads(network)],
      blockNumber: past,
      allowFailure: false,
      multicallAddress,
    }),
  ]);
  const [pastP, pastEpoch, pastScale] = pastState.slice(POOL_READS) as [bigint, bigint, bigint];
  const [pastSum, headState] = await Promise.all([
    client.multicall({ contracts: [sumRead(network, pastEpoch, pastScale)], blockNumber: past, allowFailure: false, multicallAddress }),
    client.multicall({
      contracts: [
        ...poolReads(network),
        { address: network.addresses.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" },
        ...spStateReads(network),
        sumRead(network, pastEpoch, pastScale),
        sumRead(network, pastEpoch, pastScale + 1n),
      ],
      blockNumber: headBlock,
      allowFailure: false,
      multicallAddress,
    }),
  ]);
  const [price, nowP, nowEpoch, nowScale, sumAtPastScale, sumAtNextScale] = headState.slice(POOL_READS) as [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
  ];
  return {
    pastBlock: past,
    pastTime: pastHeader.timestamp,
    headBlock,
    headTime: head.timestamp,
    price,
    pool: {
      past: parsePool(network, pastState.slice(0, POOL_READS) as unknown as PoolResults),
      now: parsePool(network, headState.slice(0, POOL_READS) as unknown as PoolResults),
    },
    sp: {
      past: { P: pastP, S: pastSum[0] as bigint, epoch: pastEpoch, scale: pastScale },
      now: { P: nowP, epoch: nowEpoch, scale: nowScale, sumAtPastScale, sumAtNextScale },
    },
  };
}

export type RouteBacktests = {
  lp: LpBacktest | null;
  sp: SpBacktest;
  seconds: bigint;
  pastTime: bigint;
  pastBlock: bigint;
  headBlock: bigint;
};

/** Both backtests for one amount over the history's real window. */
export function backtestRoutes(history: RouteHistory, amount: bigint, executorFeeBps: bigint): RouteBacktests {
  const seconds = history.headTime - history.pastTime;
  return {
    lp: lpBacktest({ past: history.pool.past, now: history.pool.now, price: history.price, amount, executorFeeBps, seconds }),
    sp: spBacktest({ past: history.sp.past, now: history.sp.now, price: history.price, amount }),
    seconds,
    pastTime: history.pastTime,
    pastBlock: history.pastBlock,
    headBlock: history.headBlock,
  };
}

/** Rejects if `promise` has not settled after `ms` (the public testnet RPC can hang). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `cd web && npx vitest run src/lib/compare && npx tsc --noEmit`
Expected: PASS, with no type errors.

- [ ] **Step 6: Check the reads against the live chain once**

Run, from `web/`, a one-off script in the session scratchpad (not committed) that calls `fetchRouteHistory(createPublicClient({ transport: http("https://mainnet.mezo.public.validationcloud.io") }) as unknown as HistoryClient, networks.mainnet)` through `npx tsx`. Print `backtestRoutes(history, 1000n * 10n ** 18n, 0n)`.
Expected: the window is ≈29–31 days, the LP `feeReturn` is ≈1.2e15–1.3e15, the SP has `liquidated: false`, and nothing throws. Repeat with `https://rpc.test.mezo.org` and `networks.testnet`, where the LP `feeReturn` is near 0. If `tsx` is not installed, use `npx --yes tsx`; do not add it to `package.json`.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/abi/musd.ts web/src/lib/compare/history.ts web/src/lib/compare/history.test.ts
git commit -m "feat(web): read both routes at the block 30 days back and at the head

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Display strings and amount parsing

**Files:**
- Create: `web/src/lib/compare/view.ts`
- Create: `web/src/lib/compare/view.test.ts`

**Interfaces:**
- Consumes: `LpBacktest` (Task 2), `SpBacktest` (Task 3), `parseMusdAmount` from `@/lib/quote/amount`, and `formatPercent`/`formatToken` from `@/lib/format`.
- Produces:
  - `REFERENCE_AMOUNT = 1_000n * WAD`.
  - `amountState(text: string): { amount: bigint | null; error: string | null }`.
  - `lpHistoryLine(bt: LpBacktest): string`.
  - `spHistoryLine(bt: SpBacktest): string`.
  - `signedChange(valueNow: bigint, amount: bigint): string`.
  - `windowDate(unixSeconds: bigint): string`.
  - `windowDays(seconds: bigint): number`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/compare/view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { WAD } from "@/lib/math";
import type { LpBacktest } from "./lp-backtest";
import type { SpBacktest } from "./sp-backtest";
import { amountState, lpHistoryLine, REFERENCE_AMOUNT, signedChange, spHistoryLine, windowDate, windowDays } from "./view";

const ONE = WAD;

describe("amountState", () => {
  it("parses a typed amount", () => {
    expect(amountState("20")).toEqual({ amount: 20n * ONE, error: null });
    expect(amountState(" 20.5 ")).toEqual({ amount: 20_500_000_000_000_000_000n, error: null });
  });

  it.each(["", "  ", "0", "0.0", ".", "0."])("treats %j as empty, without an error", (text) => {
    expect(amountState(text)).toEqual({ amount: null, error: null });
  });

  it.each(["abc", "20,5", "-1", "1.1234567890123456789"])("rejects %j with a message", (text) => {
    const state = amountState(text);
    expect(state.amount).toBeNull();
    expect(state.error).toBe("Enter an MUSD amount like 20 or 20.5 (up to 18 decimals).");
  });
});

describe("history lines", () => {
  const lp = { feeReturn: 1_248_000_000_000_000n, feeRate: 15_750_000_000_000_000n } as LpBacktest;

  it("shows LP fees over the window and as a simple yearly rate", () => {
    expect(lpHistoryLine(lp)).toBe("Fees 0.12% (≈1.5% a year, fees only)");
  });

  it("never annualises the Stability Pool", () => {
    expect(spHistoryLine({ liquidated: false } as SpBacktest)).toBe("No liquidations reached the pool");
    expect(
      spHistoryLine({ liquidated: true, gainReturn: 160_000_000_000_000_000n, lossReturn: 100_000_000_000_000_000n } as SpBacktest),
    ).toBe("BTC gains 16% · deposit absorbed 10%");
  });
});

describe("signedChange", () => {
  it("signs the change in MUSD and percent with a true minus", () => {
    expect(signedChange(1_028_900_000_000_000_000_000n, 1_000n * ONE)).toBe("+28.9 MUSD (+2.89%)");
    expect(signedChange(990n * ONE, 1_000n * ONE)).toBe("−10 MUSD (−1%)");
    expect(signedChange(1_000n * ONE, 1_000n * ONE)).toBe("+0 MUSD (+0%)");
  });
});

describe("window labels", () => {
  it("dates the window start in UTC and counts whole days", () => {
    expect(windowDate(1_789_528_999n)).toBe("Sep 16");
    expect(windowDays(2_499_138n)).toBe(29);
    expect(REFERENCE_AMOUNT).toBe(1_000n * ONE);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd web && npx vitest run src/lib/compare/view.test.ts`
Expected: FAIL with "Failed to resolve import "./view"".

- [ ] **Step 3: Implement `view.ts`**

Create `web/src/lib/compare/view.ts`:

```ts
import { formatPercent, formatToken } from "@/lib/format";
import { WAD } from "@/lib/math";
import { parseMusdAmount } from "@/lib/quote/amount";
import type { LpBacktest } from "./lp-backtest";
import type { SpBacktest } from "./sp-backtest";

/** The backtest's amount while the field is empty. */
export const REFERENCE_AMOUNT = 1_000n * WAD;

const AMOUNT_ERROR = "Enter an MUSD amount like 20 or 20.5 (up to 18 decimals).";
/** Empty or zero in any spelling: no amount yet, and no error. */
const ZERO = /^0*\.?0*$/;

export function amountState(text: string): { amount: bigint | null; error: string | null } {
  const trimmed = text.trim();
  const amount = parseMusdAmount(trimmed);
  if (amount !== null) return { amount, error: null };
  return { amount: null, error: ZERO.test(trimmed) ? null : AMOUNT_ERROR };
}

export function lpHistoryLine(bt: LpBacktest): string {
  return `Fees ${formatPercent(bt.feeReturn, 2)} (≈${formatPercent(bt.feeRate, 1)} a year, fees only)`;
}

/** Stability Pool returns arrive in bursts, so a yearly rate from one window would mislead (spec F6). */
export function spHistoryLine(bt: SpBacktest): string {
  if (!bt.liquidated) return "No liquidations reached the pool";
  return `BTC gains ${formatPercent(bt.gainReturn, 2)} · deposit absorbed ${formatPercent(bt.lossReturn, 2)}`;
}

export function signedChange(valueNow: bigint, amount: bigint): string {
  const negative = valueNow < amount;
  const diff = negative ? amount - valueNow : valueNow - amount;
  const sign = negative ? "−" : "+";
  return `${sign}${formatToken(diff, 18, 2)} MUSD (${sign}${formatPercent((diff * WAD) / amount, 2)})`;
}

export function windowDate(unixSeconds: bigint): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Number(unixSeconds) * 1000),
  );
}

export function windowDays(seconds: bigint): number {
  return Math.round(Number(seconds) / 86_400);
}
```

- [ ] **Step 4: Run the tests**

Run: `cd web && npx vitest run src/lib/compare/view.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/compare/view.ts web/src/lib/compare/view.test.ts
git commit -m "feat(web): comparison display strings and amount parsing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Compare routes card on the dashboard

**Files:**
- Create: `web/src/lib/routes/copy.ts`
- Modify: `web/src/components/lp/RisksCard.tsx`
- Modify: `web/src/components/stability-pool/SpRisksCard.tsx`
- Create: `web/src/lib/compare/useRouteHistory.ts`
- Create: `web/src/components/dashboard/RouteComparison.tsx`
- Modify: `web/src/components/dashboard/Dashboard.tsx`

**Interfaces:**
- Consumes:
  - `compareRoutes`, `STRESS_DROP`, and `ComparedRoutes` (Task 4).
  - `fetchRouteHistory`, `backtestRoutes`, `withTimeout`, `HISTORY_TIMEOUT_MS`, `HistoryClient`, `RouteBacktests`, and `RouteHistory` (Task 5).
  - `amountState`, `lpHistoryLine`, `spHistoryLine`, `signedChange`, `windowDate`, `windowDays`, and `REFERENCE_AMOUNT` (Task 6).
  - Existing: `AmountInput`, `musd`/`btc` from `@/components/lp/units`, `entryQuery`, `spDepositQuery`, `DEFAULT_SLIPPAGE`, `formatBps`, `formatPercent`, `formatToken`, `useNetwork`.
- Produces:
  - `LP_RETURN_SOURCE`, `SP_RETURN_SOURCE`, `LP_RISKS`, and `SP_RISKS`.
  - `useRouteHistory(): { history: RouteHistory | undefined; error: Error | null; retry: () => void }`.
  - `<RouteComparison snapshot={…} />`.

- [ ] **Step 1: Move the route copy into one module**

Create `web/src/lib/routes/copy.ts`:

```ts
// Route copy shared by the comparison card and the route pages (Flow B), so they never disagree.

export const LP_RETURN_SOURCE = "Swap fees paid by traders";
export const SP_RETURN_SOURCE = "BTC from liquidations, bought below the debt it repays";

export const LP_RISKS = [
  "Impermanent loss: if the BTC price moves, your pool share can be worth less than holding MUSD.",
  "About half of your deposit becomes BTC. If this MUSD is borrowed against BTC, a BTC drop hits your Trove and this position at the same time.",
  "MezoRoute is unaudited software.",
];

export const SP_RISKS = [
  "Your deposit shrinks when the pool absorbs liquidated debt; you receive that Trove's BTC instead, usually worth more than the debt.",
  "Withdrawals pause while any Trove is under-collateralised. Claiming your BTC gain is never paused.",
  "BTC gains arrive only when liquidations happen, and their value moves with the BTC price.",
];
```

In `web/src/components/lp/RisksCard.tsx`:
- Delete the `const RISKS = [ … ];` block.
- Add `import { LP_RISKS } from "@/lib/routes/copy";` at the top.
- Change `const risks = borrow ? [BORROW_RISK, ...RISKS] : RISKS;` to `const risks = borrow ? [BORROW_RISK, ...LP_RISKS] : LP_RISKS;`.

In `web/src/components/stability-pool/SpRisksCard.tsx`:
- Delete the `const RISKS = [ … ];` block.
- Add `import { SP_RISKS } from "@/lib/routes/copy";` at the top.
- Change `RISKS.map` to `SP_RISKS.map`.

- [ ] **Step 2: Add the history hook**

Create `web/src/lib/compare/useRouteHistory.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { useNetwork } from "@/lib/config/network-context";
import { fetchRouteHistory, HISTORY_TIMEOUT_MS, withTimeout, type HistoryClient, type RouteHistory } from "./history";

/** 30-day results barely move within minutes; one fetch per 10 minutes is enough. */
const STALE_MS = 10 * 60_000;

/** The two-block history for the comparison card. A failure affects only the 30-day rows (spec F6 §2). */
export function useRouteHistory(): { history: RouteHistory | undefined; error: Error | null; retry: () => void } {
  const { network } = useNetwork();
  const client = usePublicClient({ chainId: network.chainId });
  const query = useQuery({
    queryKey: ["route-history", network.chainId],
    enabled: client !== undefined,
    staleTime: STALE_MS,
    retry: false,
    queryFn: () => withTimeout(fetchRouteHistory(client as unknown as HistoryClient, network), HISTORY_TIMEOUT_MS),
  });
  return { history: query.data, error: query.error, retry: () => void query.refetch() };
}
```

- [ ] **Step 3: Build the card**

Create `web/src/components/dashboard/RouteComparison.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AmountInput } from "@/components/lp/AmountInput";
import { btc, musd } from "@/components/lp/units";
import { compareRoutes, STRESS_DROP, type ComparedRoutes } from "@/lib/compare/comparison";
import { backtestRoutes, type RouteBacktests } from "@/lib/compare/history";
import { useRouteHistory } from "@/lib/compare/useRouteHistory";
import { amountState, lpHistoryLine, REFERENCE_AMOUNT, signedChange, spHistoryLine, windowDate, windowDays } from "@/lib/compare/view";
import { useNetwork } from "@/lib/config/network-context";
import type { DashboardSnapshot } from "@/lib/dashboard/snapshot";
import { formatBps, formatPercent, formatToken } from "@/lib/format";
import { DEFAULT_SLIPPAGE } from "@/lib/quote/entry";
import { LP_RETURN_SOURCE, LP_RISKS, SP_RETURN_SOURCE, SP_RISKS } from "@/lib/routes/copy";
import { entryQuery } from "@/lib/routes/musd-btc-lp/intent";
import { spDepositQuery } from "@/lib/stability-pool/intent";

const FOOTNOTE =
  "Past results, not a forecast. Values in MUSD at today's oracle price. LP gauge rewards are not included; the −30% row uses the constant-product approximation and does not model new liquidations.";
const ENTER_AMOUNT = "Enter an amount";

type Row = { label: string; title?: string; value: ReactNode; sub?: string };

/** Flow B / FR-19: both routes for the typed amount, with what each paid over the last 30 days. */
export function RouteComparison({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { network } = useNetwork();
  const [text, setText] = useState("");
  const { amount, error: amountError } = amountState(text);
  const executorFeeBps = network.executor?.feeBps ?? null;
  const compared = amount === null ? null : compareRoutes({ snapshot, amount, executorFeeBps });
  const { history, error: historyError, retry } = useRouteHistory();
  const historyFailed = history === undefined && historyError !== null;
  const backtestAmount = amount ?? REFERENCE_AMOUNT;
  const backtests = history ? backtestRoutes(history, backtestAmount, executorFeeBps ?? 0n) : null;
  const typed = amount === null ? "" : text.trim();

  const pending = (value: (b: RouteBacktests) => ReactNode): ReactNode =>
    backtests ? value(backtests) : historyFailed ? "Unavailable" : <Skeleton />;
  const historyRow = (line: (b: RouteBacktests) => string): Row => ({
    label: backtests ? `Last ${windowDays(backtests.seconds)} days` : "Last 30 days",
    title: backtests ? `Blocks ${backtests.pastBlock} → ${backtests.headBlock}` : undefined,
    value: pending(line),
  });
  const backtestRow = (valueNow: (b: RouteBacktests) => bigint | null): Row => {
    const value = backtests ? valueNow(backtests) : null;
    return {
      label: `${formatToken(backtestAmount, 18, 2)} MUSD ${backtests ? `on ${windowDate(backtests.pastTime)}` : "30 days ago"}`,
      value: pending(() => (value === null ? "Unavailable" : `${musd(value)} today`)),
      sub: value === null ? undefined : signedChange(value, backtestAmount),
    };
  };

  const lpRows: Row[] = [
    { label: "Return source", value: LP_RETURN_SOURCE },
    historyRow((b) => (b.lp ? lpHistoryLine(b.lp) : "Unavailable")),
    backtestRow((b) => b.lp?.valueNow ?? null),
    { label: "MezoRoute fee", value: lpFee(executorFeeBps, compared) },
    ...lpAmountRows(compared),
  ];
  const spRows: Row[] = [
    { label: "Return source", value: SP_RETURN_SOURCE },
    historyRow((b) => spHistoryLine(b.sp)),
    backtestRow((b) => b.sp.valueNow),
    { label: "MezoRoute fee", value: "None (direct to the pool)" },
    ...spAmountRows(compared),
  ];

  return (
    <section id="compare" className="scroll-mt-4 rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-semibold">Compare routes</h2>
      <p className="mt-1 text-xs text-muted">Where to put MUSD: both routes for the same amount.</p>
      <div className="mt-3">
        <AmountInput amount={text} max={snapshot.musd} maxLabel="Wallet balance" onAmount={setText} />
        {amountError && <p className="mt-2 text-xs text-danger">{amountError}</p>}
        {compared?.overBalance && (
          <p className="mt-2 text-xs text-muted">More than your wallet holds; the route page will ask for a smaller amount.</p>
        )}
      </div>
      {historyFailed && (
        <p className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          30-day results unavailable.
          <button type="button" onClick={retry} className="font-semibold underline">
            Retry
          </button>
        </p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <RouteColumn
          title="MUSD/BTC LP"
          tagline="Earn swap fees"
          rows={lpRows}
          risks={LP_RISKS}
          href={`/route/lp/${entryQuery({ amount: typed, slippageBps: DEFAULT_SLIPPAGE })}`}
          cta="Choose LP"
        />
        <RouteColumn
          title="Stability Pool"
          tagline="Back the system"
          rows={spRows}
          risks={SP_RISKS}
          href={`/route/stability-pool/${spDepositQuery(typed)}`}
          cta="Choose Stability Pool"
        />
      </div>
      <p className="mt-3 text-[11px] leading-snug text-muted">{FOOTNOTE}</p>
    </section>
  );
}

function lpFee(executorFeeBps: bigint | null, compared: ComparedRoutes | null): string {
  if (executorFeeBps === null) return "Set at launch";
  if (compared?.lp.status === "ok") return `${formatBps(executorFeeBps)} (${musd(compared.lp.fee)})`;
  return formatBps(executorFeeBps);
}

function lpAmountRows(compared: ComparedRoutes | null): Row[] {
  const dropLabel = `If BTC drops ${STRESS_DROP}%`;
  if (compared === null) {
    return [
      { label: "Position after", value: ENTER_AMOUNT },
      { label: "BTC exposure", value: ENTER_AMOUNT },
      { label: dropLabel, value: ENTER_AMOUNT },
    ];
  }
  const { lp } = compared;
  if (lp.status === "unavailable") {
    return [
      { label: "Position after", value: "Pool quote unavailable" },
      { label: "BTC exposure", value: "Pool quote unavailable" },
      { label: dropLabel, value: "Pool quote unavailable" },
    ];
  }
  return [
    {
      label: "Position after",
      value: `≈ ${musd(lp.positionValue)}`,
      sub: `≈ half becomes BTC · price impact ${formatPercent(lp.priceImpact, 2)}`,
    },
    { label: "BTC exposure", value: `${btc(lp.btcBefore)} → ${btc(lp.btcAfter)}` },
    { label: dropLabel, value: `≈ ${musd(lp.valueAfterDrop)}` },
  ];
}

function spAmountRows(compared: ComparedRoutes | null): Row[] {
  const dropLabel = `If BTC drops ${STRESS_DROP}%`;
  if (compared === null) {
    return [
      { label: "Position after", value: ENTER_AMOUNT },
      { label: "BTC exposure", value: ENTER_AMOUNT },
      { label: dropLabel, value: ENTER_AMOUNT },
    ];
  }
  const { sp } = compared;
  return [
    { label: "Position after", value: musd(sp.positionValue), sub: "Stays in MUSD until liquidations" },
    { label: "BTC exposure", value: `${btc(sp.btcBefore)} → ${btc(sp.btcAfter)}` },
    { label: dropLabel, value: musd(sp.valueAfterDrop), sub: "New liquidations not modelled" },
  ];
}

function RouteColumn({
  title,
  tagline,
  rows,
  risks,
  href,
  cta,
}: {
  title: string;
  tagline: string;
  rows: Row[];
  risks: string[];
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-line p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-xs text-muted">{tagline}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-muted" title={row.title}>
              {row.label}
            </dt>
            <dd>
              {row.value}
              {row.sub && <span className="block text-xs text-muted">{row.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs font-medium">Risks</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted">
        {risks.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
      <Link
        href={href}
        className="mt-4 inline-block self-start rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90"
      >
        {cta}
      </Link>
    </div>
  );
}

function Skeleton() {
  return <span aria-label="Loading" className="inline-block h-4 w-28 animate-pulse rounded bg-line" />;
}
```

- [ ] **Step 4: Put the card on the dashboard**

In `web/src/components/dashboard/Dashboard.tsx`:
- Add `import { RouteComparison } from "./RouteComparison";` after the `ReadinessCard` import.
- In `DashboardBody`, insert `<RouteComparison snapshot={snapshot} />` between `<ExposurePanel snapshot={snapshot} />` and `<PositionsSummary … />`.
- Update the `Dashboard` doc comment to `/** The connected home page (spec §9 screen 1): warning, readiness, Trove, exposure, route comparison. */`.

- [ ] **Step 5: Test, build, and check the export**

Run: `cd web && npm test && npm run build`
Expected: all tests PASS; the build (lint, type check, export, and the `postbuild` relayer guard) succeeds. If lint flags `react/no-unescaped-entities` in copy, use `&apos;`/`&quot;` only in JSX text, never in the shared constants.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/routes/copy.ts web/src/components/lp/RisksCard.tsx web/src/components/stability-pool/SpRisksCard.tsx web/src/lib/compare/useRouteHistory.ts web/src/components/dashboard/RouteComparison.tsx web/src/components/dashboard/Dashboard.tsx
git commit -m "feat(web): compare routes card on the dashboard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Agent QA on both networks and docs

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-f6-route-comparison-design.md` (QA result)
- Modify: `PRODUCT_SPEC.md` (Flow B, FR-19, §16)
- Modify: `CLAUDE.md` (frontend notes)

**Interfaces:**
- Consumes: the built export in `web/out` (Task 7).
- Produces: a recorded QA result and updated docs.

- [ ] **Step 1: Serve the export**

Run, in the background: `cd web/out && python3 -m http.server 4310`. Restart it after any rebuild.

- [ ] **Step 2: Testnet QA with a keyless mock wallet (Playwright MCP)**

Use the read-only recipe from earlier QA: `page.context().addInitScript` injects an EIP-1193 mock that answers `eth_accounts`/`eth_requestAccounts` with the can-borrow account `0xe618B9B519Ee71a7e38D6f0c2e9479c573600D56`, `eth_chainId` with `0x7b7b` (31611), and forwards every other method to `https://rpc.test.mezo.org`. Open `http://127.0.0.1:4310/`, connect, and check:
1. The "Compare routes" card sits between BTC exposure and Positions. With an empty field, rows 1–3 and Risks show, the backtest uses 1,000 MUSD, and rows 5–7 read "Enter an amount".
2. Within 15 s the 30-day rows show a window of ≈30 days. Hovering the label shows "Blocks X → Y". Then:
   - Run `cast call <pool> "index0()(uint256)" -b X` and `-b Y` with `-r https://rpc.test.mezo.org`.
   - Confirm that the LP fee figure matches `(Δindex × liquidity)` to the shown precision; the testnet pool's fees are ≈0%.
   - Confirm that SP reads "No liquidations reached the pool" when `P()` at X equals `P()` at Y.
3. Typing `20` shows:
   - the fee as "0.1% (0.02 MUSD)";
   - the LP position ≈19.9x MUSD with a price impact;
   - LP BTC exposure rising by ≈ half of 20 MUSD in BTC;
   - SP position 20 MUSD.
4. `20,5` shows the amount error. `0` shows no error, with rows back to "Enter an amount". `99999999` shows the over-balance note.
5. "Choose LP" opens `/route/lp/?amount=20&slippage=0.5` with 20 filled in. "Choose Stability Pool" opens `/route/stability-pool/?amount=20`.
6. History failure: reload with a `page.route` interceptor that aborts JSON-RPC POSTs whose body holds an `eth_call` carrying a non-`latest` block tag. Expect "30-day results unavailable." with Retry, while rows 4–7 still work for `20`. Retry without the interceptor fills the rows.
7. At 360 px width there is no horizontal scroll and the columns stack.

- [ ] **Step 3: Mainnet QA (read-only)**

Switch the network to Mainnet. Use the mock with chain `0x7b7c` (31612), RPC `https://mainnet.mezo.public.validationcloud.io`, and the mainnet Trove account `0xDc887b3D44bdf789d60D2d427d5E8dB6e4ED6aD1`. Check:
- the LP fee row reads "Set at launch";
- the LP 30-day line is ≈0.1% with ≈1.5% a year;
- SP reads "No liquidations reached the pool";
- typing 20 gives sensible LP and SP rows;
- "Choose LP" lands on the route page's read-only mainnet state.

- [ ] **Step 4: Record the QA result and update the docs**

In the F6 spec, append a `### QA result (<date>): agent run passed` section under "Done when". List what each check showed, with the block numbers and figures, and any bug fixed on the way. Bugs found in QA are fixed with a test first and committed separately as `fix(web): …`.

In `PRODUCT_SPEC.md`:
- Add two rows to the Flow B table, after "MezoRoute fee":
  - `| Last 30 days | Swap fees as a share of the amount, and a simple yearly rate (fees only) | Liquidations absorbed: BTC gained and deposit absorbed; never annualised |`
  - `| Your amount 30 days ago → today | Backtest from the pool fee indexes and reserves at both blocks | Backtest with the pool's P/S (Liquity v1 maths) |`
- Change FR-19's text to: `Both routes are compared for the entered amount with return source, risks, fee, exposure effect, and the last 30 days' on-chain results (two-block state reads, not a forecast)`.
- Add after the F5 "done" line in §16: `F6 done <date>: Route comparison card on the dashboard: per-amount LP vs Stability Pool (fee, position, BTC exposure, −30%), 30-day results and a backtest of the amount from archive reads at two blocks; design in docs/superpowers/specs/2026-10-15-f6-route-comparison-design.md.`

In `CLAUDE.md`, add a frontend bullet after "Stability Pool (F5)":

```markdown
- Route comparison (F6): a "Compare routes" card on the dashboard (`src/components/dashboard/RouteComparison.tsx`). Per-amount rows come from the dashboard snapshot, which now reads `PoolFactory.getFee` (`DashboardSnapshot.poolFeeBps`; the LP route snapshot reuses it). The 30-day rows come from archive `eth_call` at the block ≈30 days back and at the head (`src/lib/compare/history.ts`; the past block comes from the average block time over the last 100,000 blocks, and the window shown uses real timestamps). LP fees are the pool's `index0/index1` growth (exact for unstaked LP); the Stability Pool uses Liquity v1's P/S/epoch/scale maths (`sp-backtest.ts`, checked to the wei against a live depositor). Never annualise the Stability Pool (returns come in bursts). A history failure only blanks the 30-day rows. Route risk copy lives in `src/lib/routes/copy.ts`. Design: `docs/superpowers/specs/2026-10-15-f6-route-comparison-design.md`.
```

- [ ] **Step 5: Final verification**

Run: `cd web && npm test && npm run build && cd ../contracts && forge fmt --check`
Expected: everything passes. Run `git status` and confirm there are no `* 2*` duplicates.

- [ ] **Step 6: Commit**

```bash
git add PRODUCT_SPEC.md CLAUDE.md docs/superpowers/specs/2026-10-15-f6-route-comparison-design.md
git commit -m "docs: F6 route comparison QA and spec updates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
