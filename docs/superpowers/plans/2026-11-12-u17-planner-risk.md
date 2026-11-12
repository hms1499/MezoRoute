# U17 Planner Risk and Wallet-free Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The planners state BTC risk and the cost of entering before the yield, both routes and `/compare/` work without a wallet, and an amount the chain would refuse is refused at the field before connecting.

**Architecture:** Every new figure is a pure function over values the pages already read (one new module, `src/lib/flow/entry-worth.ts`, plus additions beside existing helpers); pages stay compositions. The Stability Pool planner and `/compare/` reuse U13's pattern: the same snapshot hooks read with `zeroAddress` when there is no account. No file under `src/lib/tx`, `src/lib/quote`, or any gate rule changes.

**Tech Stack:** Next 14 static export, React 18, wagmi 2 / viem 2, Vitest, Tailwind (tokens and guards in `frontend/DESIGN.md`).

**Spec:** `docs/superpowers/specs/2026-11-12-u17-planner-risk-design.md`

## Global Constraints

- Work in `frontend/` on branch `feat/u17-planner-risk`. Run a single test file with `cd frontend && npx vitest run <path>`; the full gate is `cd frontend && npm test && npm run build`.
- `entryBlock` (`src/lib/routes/musd-btc-lp/gate.ts`), `quoteEntry`, calldata, gas budgets, and contracts are not edited. A connected user's blocks, recoveries, steps, and payloads equal `main`.
- The Stability Pool never shows a rate, an APR, a percentage return, or the word "earn".
- Without a wallet no `0` is shown as the visitor's balance, deposit, gain, or total exposure, and no notice blames a wallet (insufficient balance, gas, wrong network).
- One accent button per page. `Connect to review` stays enabled when an amount is refused.
- The entry gap shows from 1% (`PRICE_IMPACT_WARN`) and never as a gain.
- Planner LP values are at the oracle price (`dashboard.price`); `/compare/` keeps the pool price.
- Copy: rates are "this week's"; staking copy says swap fees go to veBTC voters; card rows format with the helpers in `src/components/lp/units.ts` (`musd` is 4 decimals, `btc` 6, `btcFine` 8, `lp` 6); the comparison aside and the gap line use `formatToken(value, 18, 2)`, as the aside does today.
- Every flow-route state renders `FlowColumn` or `FlowState`; `src/lib/ui/layout.test.ts` must pass. One h1 per page. `Term` never inside a link, button, or tab.
- No wagmi hook in a module that `layout.tsx`/`page.tsx` import statically; pages keep their `"use client"` components.
- Commits: `feat(frontend): …` / `test(frontend): …` / `docs: …`, each ending with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. **A pool that cannot quote** (zero reserves or supply): the comparison's LP figures are absent, the rows say "Pool quote unavailable", nothing throws. Test in Task 5.
2. **Zero or dust amounts** (`putIn` 0, a quote whose value rounds to 0): no division by zero, no gap line. Test in Task 1.
3. **Hostile `?amount=`** (`abc`, `-5`, `1e5`, `1,000`, 40 digits) on `/route/lp/`, `/route/stability-pool/`, `/compare/`: falls back to the empty or example state, never `NaN`, never written back to the URL. Tests in Tasks 7 and 11.
4. **A BTC entry**: the exposure row carries no MUSD loss, the price-impact cost is in BTC, the gap compares against `btcIn × price`. Tests in Tasks 1 and 2.
5. **Wallet connects or disconnects while a wallet-free page is open**: the amount stays, wallet rows appear or disappear, no hook-order error. Row tests for both states in Task 10; observed in the browser in Task 14.

---

### Task 1: Entry worth, gap, and price-impact cost

**Files:**
- Create: `frontend/src/lib/flow/entry-worth.ts`
- Test: `frontend/src/lib/flow/entry-worth.test.ts`

**Interfaces:**
- Consumes: `lpValueAfterDrop` (`@/lib/exposure/exposure`), `STRESS_DROP` (`@/lib/compare/comparison`), `PRICE_IMPACT_WARN` (`@/lib/routes/musd-btc-lp/gate`), `EntryQuote`, `BtcEntryQuote` (`@/lib/quote/entry`), `formatToken`, `formatPercent` (`@/lib/format`), `WAD` (`@/lib/math`).
- Produces:

```ts
export type EntryWorth = {
  value: bigint;          // MUSD: this deposit's LP share of the pool after the entry, its BTC at the oracle price
  btcShare: bigint;       // BTC in that share
  putIn: bigint;          // MUSD put in (a BTC entry: btcIn × price / WAD)
  gap: bigint;            // putIn − value; ≤ 0 when the position is worth at least what went in
  valueAfterDrop: bigint; // lpValueAfterDrop(value, STRESS_DROP)
  lossAfterDrop: bigint;  // putIn − valueAfterDrop
};
export function entryWorth(quote: Pick<EntryQuote, "liquidity" | "after">, price: bigint, putIn: bigint): EntryWorth;
/** Null below 1% of `putIn`, when `gap ≤ 0`, or when `putIn` is 0. */
export function entryGap(worth: EntryWorth): { amount: string; percent: string } | null;
export function entryGapLine(worth: EntryWorth, putInLabel: string): string | null;
export const ENTRY_GAP_CAUSE = "MezoRoute fee, the pool's swap fee, and the pool's BTC price";
export function priceImpactCost(quote: EntryQuote | BtcEntryQuote): { amount: bigint; unit: "MUSD" | "BTC" };
```

The share is `liquidity × after.reserve / after.totalSupply` for each reserve (the formula `src/lib/landing/simulate.ts` uses), with BTC valued at `price`.

- [ ] **Step 1: Write the failing tests**

```ts
const E = 10n ** 18n;
const quote = { liquidity: 10n * E, after: { reserveMusd: 1000n * E, reserveBtc: 1n * E, totalSupply: 100n * E } } as never;

it("values the share at the oracle price", () => {
  const w = entryWorth(quote, 900n * E, 200n * E);
  expect(w).toEqual({
    value: 190n * E, btcShare: E / 10n, putIn: 200n * E, gap: 10n * E,
    valueAfterDrop: lpValueAfterDrop(190n * E, 30), lossAfterDrop: 200n * E - lpValueAfterDrop(190n * E, 30),
  });
});
it("says the gap from 1% and never as a gain", () => {
  expect(entryGapLine(entryWorth(quote, 900n * E, 200n * E), "200 MUSD")).toBe(
    "≈ 10 MUSD (5%) below the 200 MUSD you put in, at the BTC price: MezoRoute fee, the pool's swap fee, and the pool's BTC price.",
  );
  expect(entryGap({ ...entryWorth(quote, 900n * E, 200n * E), putIn: 19192n * E / 100n, gap: 192n * E / 100n })).not.toBeNull(); // ≥ 1%
  expect(entryGap({ ...entryWorth(quote, 900n * E, 200n * E), putIn: 19189n * E / 100n, gap: 189n * E / 100n })).toBeNull();     // < 1%
  expect(entryGap(entryWorth(quote, 900n * E, 180n * E))).toBeNull(); // worth more than put in
  expect(entryGap(entryWorth(quote, 900n * E, 0n))).toBeNull();       // Review Focus 2
});
it("prices the impact in the token that is swapped", () => {
  expect(priceImpactCost({ musdToSwap: 500n * E, priceImpact: E / 50n } as never)).toEqual({ amount: 10n * E, unit: "MUSD" });
  expect(priceImpactCost({ btcIn: E, btcToSwap: E / 2n, priceImpact: E / 50n } as never)).toEqual({ amount: E / 100n, unit: "BTC" });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/flow/entry-worth.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement the module.** `entryGap` formats `amount` with `formatToken(gap, 18, 2)` and `percent` with `formatPercent(gap × WAD / putIn, 0)`; `entryGapLine` is `≈ ${amount} MUSD (${percent}) below the ${putInLabel} you put in, at the BTC price: ${ENTRY_GAP_CAUSE}.`; a quote is a BTC entry when `"btcIn" in quote` (the test `gate.ts` already uses).
- [ ] **Step 4: Run the test** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): entry worth, gap, and price-impact cost (U17)`.

---

### Task 2: LP card shows exposure, the −30% loss, and what the LP is worth

**Files:**
- Create: `frontend/src/components/lp/entry-rows.ts`, `frontend/src/components/lp/entry-rows.test.ts`
- Modify: `frontend/src/components/lp/LpRoutePage.tsx` (the `overview`, `context`, and `receive` blocks), `frontend/src/components/lp/LpEntryCard.tsx` (`receive` prop), `frontend/src/components/flow/ReceiveRow.tsx`

**Interfaces:**
- Consumes: Task 1's `entryWorth`, `entryGapLine`, `priceImpactCost`; `musd`, `btc`, `btcFine`, `lp` from `./units`.
- Produces:

```ts
type Row = { label: string; value: string; sub?: string; tone?: "btc" | "warning" };
export function lpExposureRow(input: { exposureChange: bigint; worth: EntryWorth | null; fromBtc: boolean }): Row;
export function priceImpactRow(quote: EntryQuote | BtcEntryQuote): Row;
export function lpReceive(input: { worth: EntryWorth; liquidity: bigint; minLpOut: bigint; putInLabel: string }): { value: string; minimum: string; note: string | null };
```

`ReceiveRow` gains `note?: ReactNode`, rendered under `minimum` as `text-sm text-warning-ink`. `LpEntryCard`'s `receive` becomes `{ value: string; minimum: string; note?: string | null } | null`.

- [ ] **Step 1: Write the failing tests** (`w = entryWorth(quote, 900n * E, 200n * E)` with Task 1's fixture)

```ts
it("puts the loss against what was put in under the exposure", () => {
  expect(lpExposureRow({ exposureChange: E / 10n, worth: w, fromBtc: false })).toEqual({
    label: "BTC exposure", value: `+${btc(E / 10n)}`, sub: `If BTC −30%: ≈ −${musd(w.lossAfterDrop)}`, tone: "btc",
  });
});
it("gives a BTC entry no MUSD loss", () => {
  expect(lpExposureRow({ exposureChange: E / 10n, worth: w, fromBtc: true }).sub).toBe("pool share only; the BTC you deposit leaves your wallet");
});
it("keeps a negative change's sign", () => {
  expect(lpExposureRow({ exposureChange: -E / 10n, worth: null, fromBtc: false }).value).toBe(`−${btc(E / 10n)}`);
});
it("adds the impact's cost from 1%", () => {
  expect(priceImpactRow({ musdToSwap: 500n * E, priceImpact: E / 50n } as never)).toEqual({
    label: "Price impact", value: "2%", sub: `≈ ${musd(10n * E)} · includes the pool's swap fee`, tone: "warning",
  });
  expect(priceImpactRow({ musdToSwap: 500n * E, priceImpact: E / 2500n } as never)).toEqual({
    label: "Price impact", value: "0.04%", sub: "includes the pool's swap fee",
  });
});
it("leads with the MUSD value", () => {
  expect(lpReceive({ worth: w, liquidity: 10n * E, minLpOut: 99n * E / 10n, putInLabel: "200 MUSD" })).toEqual({
    value: `LP worth ≈ ${musd(190n * E)}`, minimum: `≈ ${lp(10n * E)} · at least ${lp(99n * E / 10n)}`, note: entryGapLine(w, "200 MUSD"),
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/lp/entry-rows.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement `entry-rows.ts`.** The percentage is `formatPercent(quote.priceImpact, 2)`; a BTC-unit cost formats with `btcFine`.
- [ ] **Step 4: Wire `LpRoutePage`.** Compute `worth` once from `quote`, `dashboard.price`, and `putIn` (`intent.musdIn`, or `intent.btcIn × dashboard.price / WAD` for a BTC entry). `overview` becomes: Deposited to the pool, `lpExposureRow` (when `exposureChange !== null`), MezoRoute fee, `priceImpactRow`, Staking. Remove the BTC exposure entry from `context`. `receive` is `lpReceive(...)` with `putInLabel` = the amount as typed plus its unit (`musd(intent.musdIn)` or `btcFine(intent.btcIn)`).
- [ ] **Step 5: Run** `npm test` — Expected: PASS (update `lp-route.test.ts` expectations that pinned the old row order or the old receive text).
- [ ] **Step 6: Commit** `feat(frontend): BTC exposure, the −30% loss, and the LP's worth on the LP card (U17)`.

---

### Task 3: LP Confirm uses the same value

**Files:**
- Modify: `frontend/src/components/lp/ConfirmSummary.tsx` (the two "LP received" rows, lines ~64-68 and ~96-100)
- Test: the file under `frontend/src/components/lp/` that covers `ConfirmSummary`'s rows (`grep -l ConfirmSummary src/components/lp/*.test.ts`); create `confirm-summary.test.ts` if none exports them.

**Interfaces:**
- Consumes: `entryWorth`, `entryGap`, `ENTRY_GAP_CAUSE` (Task 1).
- Produces: the "LP received" row's `sub` is `` `≈ ${musd(worth.value)} at the BTC price · at least ${lp(minLpOut)}` ``, and, when `entryGap(worth)` is not null, the next row in group "You receive" is `{ label: "Below what you put in", value: `≈ ${gap.amount} MUSD (${gap.percent})`, sub: `at the BTC price: ${ENTRY_GAP_CAUSE}`, tone: "warning" }`.

- [ ] **Step 1: Write the failing test**: for a quote whose worth is 5% under the amount, the rows contain the "Below what you put in" row above and no row's `sub` contains `at the pool price`; for a quote within 1%, no such row.
- [ ] **Step 2: Run it** — Expected: FAIL on `at the pool price`.
- [ ] **Step 3: Implement** for both the MUSD and the BTC branch (`putIn` as in Task 2). `entryValue` stays in `src/lib/quote/entry.ts` for `/compare/`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): the LP Confirm values the position like the planner (U17)`.

---

### Task 4: The preview chart measures from what was put in

**Files:**
- Modify: `frontend/src/lib/exposure/plots.ts`, `frontend/src/lib/exposure/plots.test.ts`, `frontend/src/components/dashboard/ExposurePanel.tsx`, `frontend/src/components/lp/LpRoutePage.tsx`

**Interfaces:**
- Produces:

```ts
/** `at`: the flat value to draw (a deposit preview's "value before + amount put in"); default today's value (U15). */
export function baselineFor(series: Series[], at?: number): Series | null;
/** The exposure panel's headline. `scope: "deposit"` is a preview with no wallet. */
export function exposureHeadline(input: { current: bigint; prior: bigint | null; scope: "account" | "deposit" }): { figure: string; caption: string };
```

`ExposurePanel` gains `putIn?: bigint` (MUSD the previewed deposit puts in) and `scope?: "account" | "deposit"` (default `"account"`).

- [ ] **Step 1: Write the failing tests**

```ts
it("draws the baseline where the caller says", () => {
  const lp = { id: "lp", points: [{ move: -30, value: 811 }, { move: 0, value: 970 }, { move: 30, value: 1106 }] } as Series;
  expect(baselineFor([lp], 1000)?.points.map((p) => p.value)).toEqual([1000, 1000, 1000]);
  expect(baselineFor([lp])?.points.map((p) => p.value)).toEqual([970, 970, 970]);
});
it("shows only the deposit's own BTC without a wallet", () => {
  expect(exposureHeadline({ current: 6362n * 10n ** 12n, prior: 0n, scope: "deposit" })).toEqual({
    figure: "+0.006362 BTC", caption: "This deposit only. Connect to include your Trove and positions.",
  });
  expect(exposureHeadline({ current: 2n * E, prior: E, scope: "account" })).toEqual({ figure: "1 BTC → 2 BTC", caption: "Total BTC exposure" });
  expect(exposureHeadline({ current: 2n * E, prior: null, scope: "account" })).toEqual({ figure: "2 BTC", caption: "Total BTC exposure" });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/exposure/plots.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement both functions**; in `ExposurePanel`, pass `at = toNumber(exposure(before).lpValue + putIn)` when `putIn` and `before` are given, and render the headline from `exposureHeadline`. The chart's readout already measures a single line against the baseline, so its change follows.
- [ ] **Step 4: Wire `LpRoutePage`**: `<ExposurePanel … putIn={worth.putIn} scope={connected ? "account" : "deposit"} />`.
- [ ] **Step 5: Run** `npm test` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(frontend): the deposit preview chart measures from the amount put in (U17)`.

---

### Task 5: One comparison for both planners

**Files:**
- Modify: `frontend/src/lib/flow/planner-comparison.ts`, `frontend/src/lib/flow/planner-comparison.test.ts`, `frontend/src/components/lp/PlannerComparison.tsx`, `frontend/src/components/lp/planner-comparison.test.ts`, `frontend/src/components/lp/LpRoutePage.tsx`, `frontend/src/lib/compare/default-amount.ts` (+ its test)

**Interfaces:**
- Consumes: `entryWorth` (Task 1), `quoteEntry`, `PoolState`, `mezoPerWeek`, `emissionsApr` (`@/lib/gauge/maths`), `GaugeState`.
- Produces:

```ts
export type PlannerLp = { liquidity: bigint; btcAdded: bigint; valueAfterDrop: bigint };
/** The LP side for `amountMusd`, from the pool state alone; null when the pool cannot quote. */
export function plannerLpFigures(input: { pool: PoolState; price: bigint; amountMusd: bigint; executorFeeBps: bigint }): PlannerLp | null;
/** This week's rate for `liquidity` LP; both null unless the week pays. Moved out of `LpRoutePage` unchanged. */
export function lpWeekRate(input: { gauge: GaugeState | null; availability: StakeAvailability; mezoPrice: bigint | null | undefined; liquidity: bigint | null; pool: PoolState }): { apr: bigint | null; weekly: bigint | null };
export function plannerComparisonRows(input: {
  amountMusd: bigint;
  stake: { on: boolean; availability: StakeAvailability };
  apr: bigint | null; weekly: bigint | null; poolFeeBps: bigint;
  lp: PlannerLp | null;
}): PlannerCompare;
export const PLANNER_COMPARE_NOTE = "No annualised rate for the Stability Pool.";
// default-amount.ts
export function compareHref(amountText: string): string; // "/compare/" or "/compare/?amount=<text>"
```

`PlannerComparison` props become `{ amountMusd; example; state; other: "sp" | "lp"; otherHref: string | null; historyHref: string }`. `other: "sp"` keeps today's title and action; `other: "lp"` reads `Compare with the MUSD/BTC LP` / `Choose MUSD/BTC LP` and lists the Stability Pool first. Under the note it renders the text link `30-day results for both routes` to `historyHref`.

- [ ] **Step 1: Write the failing tests**

```ts
const base = { amountMusd: 1000n * E, apr: null, weekly: null, poolFeeBps: 4n, lp: { liquidity: E, btcAdded: 6362n * 10n ** 12n, valueAfterDrop: 81161n * 10n ** 16n } };
it("says who gets the swap fees", () => {
  expect(plannerComparisonRows({ ...base, stake: { on: true, availability: "between-weeks" } }).lp.slice(0, 2)).toEqual([
    { label: "You get", value: "MEZO", sub: "swap fees go to veBTC voters" },
    { label: "This week", value: "New week's rate not set yet" },
  ]);
  expect(plannerComparisonRows({ ...base, stake: { on: false, availability: "open" } }).lp.slice(0, 2)).toEqual([
    { label: "You get", value: "Swap fees" },
    { label: "This week", value: "Pool fee 0.04%" },
  ]);
});
it("puts risk and exit on both routes", () => {
  const rows = plannerComparisonRows({ ...base, stake: { on: false, availability: "open" } });
  expect(rows.lp.slice(2)).toEqual([
    { label: "BTC exposure", value: "+0.006362 BTC" },
    { label: "If BTC −30%", value: "≈ 811.61 MUSD" },
    { label: "Exit", value: "Any time, at the pool price" },
  ]);
  expect(rows.sp).toEqual([
    { label: "You get", value: "BTC from liquidations" },
    { label: "This week", value: "Variable · paid in bursts" },
    { label: "BTC exposure", value: "None until a liquidation" },
    { label: "If BTC −30%", value: "1,000 MUSD", sub: "new liquidations not modelled" },
    { label: "Exit", value: "Paused while any Trove is below MCR" },
  ]);
});
it("survives a pool that cannot quote (Review Focus 1)", () => {
  const empty = { reserveMusd: 0n, reserveBtc: 0n, totalSupply: 0n, feeBps: 4n };
  expect(plannerLpFigures({ pool: empty, price: 900n * E, amountMusd: E, executorFeeBps: 10n })).toBeNull();
  const rows = plannerComparisonRows({ ...base, lp: null, stake: { on: false, availability: "open" } });
  expect(rows.lp[2].value).toBe("Pool quote unavailable");
  expect(rows.lp[3].value).toBe("Pool quote unavailable");
});
it("gives both pages the same figures (parity)", () => {
  const pool = { reserveMusd: 1_000_000n * E, reserveBtc: 13n * E, totalSupply: 3000n * E, feeBps: 4n };
  const q = quoteEntry(pool, 1000n * E, 10n)!;
  const w = entryWorth(q, 74_000n * E, 1000n * E);
  expect(plannerLpFigures({ pool, price: 74_000n * E, amountMusd: 1000n * E, executorFeeBps: 10n })).toEqual({
    liquidity: q.liquidity, btcAdded: w.btcShare, valueAfterDrop: w.valueAfterDrop,
  });
});
it("links to the 30-day page with the amount", () => {
  expect(compareHref("250.5")).toBe("/compare/?amount=250.5");
  expect(compareHref("")).toBe("/compare/");
});
```

Keep the existing test that no Stability Pool cell contains `%`, `APR`, or `earn`.

- [ ] **Step 2: Run** `npx vitest run src/lib/flow/planner-comparison.test.ts src/lib/compare` — Expected: FAIL.
- [ ] **Step 3: Implement** the functions. The staked rate line keeps today's rule (`≈ N% APR`, else `≈ N MEZO a week`, when staked and the week is `open`).
- [ ] **Step 4: Update `PlannerComparison` and `LpRoutePage`.** The page's `apr`/`weekly` come from `lpWeekRate`; `lp` is `plannerLpFigures({ pool: data.snapshot.pool, price: dashboard.price, amountMusd: comparison.amountMusd, executorFeeBps: data.snapshot.executorFeeBps })` for typed and example amounts alike; `historyHref = compareHref(comparison.amountText)`.
- [ ] **Step 5: Run** `npm test` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(frontend): one route comparison with exposure, the −30% value, and exit (U17)`.

---

### Task 6: Refuse an amount before a wallet connects

**Files:**
- Modify: `frontend/src/lib/flow/planner.ts`, `frontend/src/lib/flow/planner.test.ts`, `frontend/src/lib/routes/musd-btc-lp/preview.ts` (expose the gate input), `frontend/src/components/lp/LpRoutePage.tsx`

**Interfaces:**
- Produces:

```ts
// preview.ts: EntryPreview gains the object already passed to entryBlock, unchanged
gateInput: EntryGateInput;
// planner.ts
export const PLANNER_AMOUNT_BLOCKS: readonly EntryBlockReason[] = ["above-cap", "too-small", "price-impact"];
/** The verdict the chain alone gives the amount: `entryBlock` with the wallet's side neutralised. */
export function plannerAmountBlock(input: EntryGateInput): EntryBlock | null;
export function plannerView(input: { connected: boolean; block: EntryBlock | null; amountBlock: EntryBlock | null; walletChainId: number | undefined; chainId: number }): PlannerView;
```

Neutralised means: `walletChainId = network.chainId`, `walletMusd = musdIn ?? 0n`, `lacksGas = false`, `quoteAgeMs = 0`, `borrow = null`, and for a BTC entry `walletBtc = btcIn ?? 0n`, `gasReserve = 0n`. The result is kept only when its reason is in `PLANNER_AMOUNT_BLOCKS`. Unconnected, `plannerView` returns `{ block: amountBlock, wrongNetwork: false }`; connected it returns exactly what it returns today.

- [ ] **Step 1: Write the failing tests** (build `EntryGateInput` with the fixture helpers `gate.test.ts` already uses)

```ts
it("refuses an amount above the cap though the wallet is empty", () => {
  expect(plannerAmountBlock({ ...input, musdIn: 5000n * E, walletMusd: 0n, maxMusdIn: 1000n * E })?.reason).toBe("above-cap");
});
it("refuses a price impact above 5%", () => {
  expect(plannerAmountBlock({ ...input, quote: { ...quote, priceImpact: 66n * E / 1000n } })?.reason).toBe("price-impact");
});
it("never blames the wallet", () => {
  expect(plannerAmountBlock({ ...input, musdIn: 500n * E, walletMusd: 0n, lacksGas: true, walletChainId: undefined, quoteAgeMs: 10 ** 9 })).toBeNull();
});
it("shows the amount block only without a wallet", () => {
  const amountBlock = { reason: "above-cap", outcome: {} } as never;
  expect(plannerView({ connected: false, block: null, amountBlock, walletChainId: undefined, chainId: 1 }).block).toBe(amountBlock);
  const block = { reason: "insufficient-balance", outcome: {} } as never;
  expect(plannerView({ connected: true, block, amountBlock, walletChainId: 1, chainId: 1 }).block).toBe(block);
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/flow/planner.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**; `entryPreview` builds the gate input once, returns it as `gateInput`, and passes the same object to `entryBlock`.
- [ ] **Step 4: Wire `LpRoutePage`**: `amountBlock: plannerAmountBlock(preview.gateInput)`. `primaryAction` is untouched (unconnected stays `Connect to review`).
- [ ] **Step 5: Run** `npm test` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(frontend): the planner refuses an unsendable amount before connecting (U17)`.

---

### Task 7: Text that is not an amount

**Files:**
- Modify: `frontend/src/lib/flow/amount.ts`, `frontend/src/lib/flow/amount.test.ts`, `frontend/src/components/lp/LpRoutePage.tsx` (`update`, `field.error`), `frontend/src/components/stability-pool/SpRoutePage.tsx` (`onAmount`, `field.error`)

**Interfaces:**
- Consumes: `amountState`, the MUSD message constant in `@/lib/compare/view`.
- Produces:

```ts
/** A message for text that can never be an amount; null for an amount, an empty field, or a zero in any spelling. */
export function amountFieldError(text: string, token: "musd" | "btc"): string | null;
/** What the URL may carry: the text, or "" when it can never be an amount. */
export function urlAmount(text: string): string;
```

BTC message: `Enter a BTC amount like 0.01 (up to 18 decimals).`

- [ ] **Step 1: Write the failing tests**

```ts
it.each(["abc-5", "-5", "1e5", "1,000", "1.2.3", "9".repeat(40) + ".1234567890123456789"])("rejects %s (Review Focus 3)", (text) => {
  expect(amountFieldError(text, "musd")).toBe("Enter an MUSD amount like 20 or 20.5 (up to 18 decimals).");
  expect(urlAmount(text)).toBe("");
});
it.each(["", "0", "0.", ".0", "12.5", " 7 "])("accepts %s", (text) => {
  expect(amountFieldError(text, "musd")).toBeNull();
  expect(urlAmount(text)).toBe(text);
});
it("names BTC", () => expect(amountFieldError("x", "btc")).toBe("Enter a BTC amount like 0.01 (up to 18 decimals)."));
```

- [ ] **Step 2: Run** `npx vitest run src/lib/flow/amount.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Wire the pages.** LP: `error: amountFieldError(intent.amount, intent.asset) ?? lpFieldError(view.block)`; in `update`, state is set from the full typed query as today, and `replaceState` receives `entryQuery({ ...next, amount: urlAmount(next.amount) })`. Stability Pool: the same with `spDepositQuery(urlAmount(next))` and `spFieldError`.
- [ ] **Step 5: Run** `npm test` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(frontend): planner fields say when text is not an amount (U17)`.

---

### Task 8: Landing simulator falls back to the example

**Files:**
- Modify: `frontend/src/lib/landing/view.ts` (+ its test), `frontend/src/lib/landing/links.ts` (+ its test), `frontend/src/components/landing/Landing.tsx`, `frontend/src/components/landing/Simulator.tsx`, `frontend/src/components/landing/SimulatorSection.tsx`

**Interfaces:**
- Consumes: `compareHref` (Task 5).
- Produces:

```ts
// view.ts
export const SIMULATOR_TESTNET_NOTE = "You're on Testnet: these figures are Mezo mainnet; your transactions will use test tokens.";
export function simulatorNotes(sim: LandingSimulation): string[];      // no longer takes the network; no testnet line
export function simulatorCaption(amount: bigint, example: boolean): string;
// links.ts
export function plannerHref(route: "lp" | "sp", amount: bigint | null): string; // null: the bare path
// Landing.tsx
export type AmountState = { text: string; amount: bigint | null; error: string | null; shown: bigint; example: boolean };
```

`shown` is the typed amount, or `DEFAULT_AMOUNT` (1,000 MUSD) whenever the field is empty, zero, or invalid; `example` is true in that case. The `lastValid` state goes.

- [ ] **Step 1: Write the failing tests**

```ts
it("labels the example", () => {
  expect(simulatorCaption(1000n * E, true)).toBe("Both routes for 1,000 MUSD (example)");
  expect(simulatorCaption(250n * E, false)).toBe("Both routes for 250 MUSD, estimated");
});
it("keeps the testnet sentence out of the footnotes", () => {
  expect(simulatorNotes(sim)).not.toContain(SIMULATOR_TESTNET_NOTE);
});
it("plans without an amount", () => {
  expect(plannerHref("lp", null)).toBe("/route/lp/");
  expect(plannerHref("sp", 1000n * E)).toBe("/route/stability-pool/?amount=1000");
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/landing` — Expected: FAIL.
- [ ] **Step 3: Implement the pure parts and update `Landing.tsx`.**
- [ ] **Step 4: Update `Simulator.tsx`:** the table's `caption` is `simulatorCaption(sim.amount, example)`; when `example` is true a visible line above the table reads `Showing 1,000 MUSD as an example.` (`text-sm text-night-muted`); `SIMULATOR_TESTNET_NOTE` renders directly under the heading row when `network.id === "testnet"`; the Plan link is `plannerHref("lp", amount)` (the typed amount, null in the example state); under it a text link `30-day results for both routes` to `compareHref(example ? "" : text.trim())`. Update the U16 comment in `links.ts`: both routes now plan without a wallet.
- [ ] **Step 5: Run** `npm test` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(frontend): the simulator shows a labelled example instead of the last amount (U17)`.

---

### Task 9: Stability Pool snapshot without an account

**Files:**
- Modify: `frontend/src/lib/stability-pool/snapshot.ts` (+ its test), `frontend/src/lib/stability-pool/useSpSnapshot.ts`

**Interfaces:**
- Produces:

```ts
export type SpSnapshot = { dashboard: DashboardSnapshot; initialDeposit: bigint; allowance: bigint; blockNumber: bigint; blockTimestamp: bigint; gauge: GaugeState | null };
export function useSpSnapshot(account: Address | undefined): { data: SpData | undefined; error: Error | null; refresh: () => Promise<SpData> };
```

`spContracts` adds `multicall3.getCurrentBlockTimestamp` right after `getBlockNumber`, so `SP_READS` is 4 and `SP_GAUGE_START` moves by one. `parseSpSnapshot` returns the gauge state it already parses.

- [ ] **Step 1: Write the failing test**: `parseSpSnapshot` on a results array with the timestamp in the fourth Stability Pool slot returns `blockTimestamp` and, on a network with a gauge, a non-null `gauge`; `spContracts(network, account)[SP_GAUGE_START - 1].functionName` is `"getCurrentBlockTimestamp"`.
- [ ] **Step 2: Run** `npx vitest run src/lib/stability-pool` — Expected: FAIL.
- [ ] **Step 3: Implement the snapshot change.**
- [ ] **Step 4: Make the hook account-optional**, exactly as `useLpRouteSnapshot` does: `account ?? zeroAddress` for the contracts, the gas-balance query `enabled: connected`, `gasBalance` `0n` and no gas error while unconnected. No `tolerate` map (the zero-address reads were verified on both networks, spec §5); if a read reverts in the browser, tolerate that index and record it in the spec.
- [ ] **Step 5: Run** `npm test && npm run build` — Expected: PASS (existing callers pass an `Address`, which still type-checks).
- [ ] **Step 6: Commit** `feat(frontend): the Stability Pool snapshot reads without an account (U17)`.

---

### Task 10: Stability Pool planner without a wallet

**Files:**
- Create: `frontend/src/components/stability-pool/entry-rows.ts`, `frontend/src/components/stability-pool/entry-rows.test.ts`
- Modify: `frontend/src/components/stability-pool/SpRoutePage.tsx`, `frontend/src/components/stability-pool/SpEntryCard.tsx`

**Interfaces:**
- Consumes: `useSpSnapshot(undefined)` (Task 9); `plannerAmount`, `plannerLpFigures`, `lpWeekRate`, `plannerComparisonRows`, `compareHref` (Task 5); `amountFieldError`, `urlAmount` (Task 7); `stakeAvailability`, `effectiveStake` (`@/lib/gauge/availability`); `useMezoPrice`; `ConnectCta`.
- Produces:

```ts
export function spEntryRows(input: { connected: boolean; musdIn: bigint | null; preview: SpDepositPreview }): { label: string; value: string; sub?: string }[];
```

`SpEntryCard`: `field.balance` becomes `bigint | null` (null passes `balance={null}` and `max={null}`), and an optional `action?: ReactNode` replaces the Review button.

- [ ] **Step 1: Write the failing tests**

```ts
const preview = { depositNow: 0n, gainPaid: 0n, depositAfter: 1000n * E, gasCost: 5n * 10n ** 11n } as never;
it("shows nothing of the visitor's without a wallet", () => {
  const labels = spEntryRows({ connected: false, musdIn: 1000n * E, preview }).map((r) => r.label);
  expect(labels).toEqual(["BTC exposure", "MezoRoute fee", "Network fee (estimated)"]);
});
it("says what a BTC fall does", () => {
  expect(spEntryRows({ connected: false, musdIn: 1000n * E, preview })[0]).toEqual({
    label: "BTC exposure", value: "None until a liquidation", sub: "If BTC −30%: 1,000 MUSD, unchanged · new liquidations not modelled",
  });
  expect(spEntryRows({ connected: false, musdIn: null, preview })[0].sub).toBe("new liquidations not modelled");
});
it("keeps the connected rows and adds the exposure row (Review Focus 5)", () => {
  const labels = spEntryRows({ connected: true, musdIn: 1000n * E, preview }).map((r) => r.label);
  expect(labels).toEqual(["Deposit after (estimated)", "Your deposit now", "Pending BTC gain", "BTC exposure", "MezoRoute fee", "Network fee (estimated)"]);
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/stability-pool/entry-rows.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `spEntryRows`** with today's values and subs for the connected rows (the page keeps the `Term` on "Pending BTC gain" by mapping that label when it renders).
- [ ] **Step 4: Rebuild `SpRoutePage` on `LpRoutePage`'s shape.** Drop `RequireWallet` and `ConnectPage`; `useAccount()` in the page, `status === "reconnecting"` → `<FlowState><LoadingCard label="Connecting wallet" lines={2} /></FlowState>`. Unconnected: `field.balance = null`, no block shown, `action = <ConnectCta label="Connect to review" variant="primary" className="w-full" arrow />`, `WrongNetworkAlert` only when connected. Aside, in order: `PlannerComparison other="lp"` then `SpDepositAside` when connected or `BeforeYouSign facts={spSignFacts(...)}` when not. The comparison's inputs: `plannerAmount({ text: amount, musdIn, cap: network.entryCap })`; pool `{ reserveMusd: dashboard.lp.reserveMusd, reserveBtc: dashboard.lp.reserveBtc, totalSupply: dashboard.lp.totalSupply, feeBps: dashboard.poolFeeBps }`; `executorFeeBps: network.executor?.feeBps ?? 0n`; stake `{ availability: stakeAvailability(snapshot.gauge, snapshot.blockTimestamp), on: effectiveStake(true, availability) }`; `otherHref` = `/route/lp/?amount=<amountText>`. `ExposurePanel` takes `scope={connected ? "account" : "deposit"}`.
- [ ] **Step 5: Run** `npm test && npm run build` — Expected: PASS, including `layout.test.ts`.
- [ ] **Step 6: Commit** `feat(frontend): the Stability Pool planner works without a wallet (U17)`.

---

### Task 11: Compare without a wallet

**Files:**
- Modify: `frontend/src/lib/dashboard/useDashboardSnapshot.ts`, `frontend/src/lib/compare/default-amount.ts` (+ test), `frontend/src/components/compare/ComparePage.tsx`, `frontend/src/components/dashboard/RouteComparison.tsx`

**Interfaces:**
- Produces:

```ts
export function useDashboardSnapshot(account: Address | undefined): { data: DashboardData | undefined; error: Error | null; refresh: () => void };
/** A valid `?amount=` starts the comparison (never an example); otherwise `defaultCompareAmount`. */
export function compareStart(param: string | null, walletMusd: bigint, cap: bigint): { text: string; example: boolean };
```

`RouteComparison` gains `start?: string | null` (the raw `amount` query value) and initialises from `compareStart(start ?? null, snapshot.musd, network.entryCap)`.

- [ ] **Step 1: Write the failing tests**

```ts
it("starts from a valid amount in the URL", () => {
  expect(compareStart("250.5", 0n, 1000n * E)).toEqual({ text: "250.5", example: false });
});
it.each([null, "", "abc", "-5", "0", "1e5"])("falls back for %s (Review Focus 3)", (param) => {
  expect(compareStart(param, 0n, 1000n * E)).toEqual({ text: "1000", example: true });
  expect(compareStart(param, 40n * E, 1000n * E)).toEqual({ text: "40", example: false });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/compare` — Expected: FAIL.
- [ ] **Step 3: Implement `compareStart`** and make the dashboard hook account-optional the same way as Task 9 (zero address, gas balance disabled and `0n`).
- [ ] **Step 4: Update `ComparePage`:** no `RequireWallet`; `useAccount()`; reconnecting shows `LoadingCard`; `useDashboardSnapshot(address)`; `WrongNetworkAlert` only when `address` is set; `RouteComparison` receives `start={useSearchParams().get("amount")}`. Remove the "Connect to compare routes" copy.
- [ ] **Step 5: Run** `npm test && npm run build` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(frontend): Compare routes works without a wallet (U17)`.

---

### Task 12: Trove connect state, the trust line, and the hero figure

**Files:**
- Create: `frontend/src/lib/leverage/connect-copy.ts`, `frontend/src/lib/leverage/connect-copy.test.ts`
- Modify: `frontend/src/components/trove/TrovePages.tsx` (`TroveAmountPage`), `frontend/src/lib/flow/sign-facts.ts` (+ test), `frontend/src/components/flow/BeforeYouSign.tsx`, `frontend/src/components/lp/LpEntryCard.tsx`, `frontend/src/components/stability-pool/SpEntryCard.tsx`, `frontend/src/components/landing/HeroFigures.tsx`

**Interfaces:**
- Produces:

```ts
// connect-copy.ts: one sentence per action, each ending "EVM wallets only."
export const TROVE_CONNECT: Record<TroveAction, string>;
// sign-facts.ts
/** The card's one-line pointer below lg: the Audit fact, then the entry cap when the list has one. */
export function trustLine(facts: SignFact[] | null): string | null;
```

Copy: unwind `Repay part of your debt from your own BTC collateral in one transaction, raising your collateral ratio. EVM wallets only.` · close `Repay all your debt from your BTC collateral and get the rest back, in one transaction. EVM wallets only.` · leverage `Borrow more MUSD and add it to your Trove as BTC in one transaction, lowering your collateral ratio. EVM wallets only.` · open `Open a Trove and lever it to your target ratio in one transaction. EVM wallets only.`

The trust line follows each route's own Audit fact, so the Stability Pool reads `Mezo's contract; MezoRoute adds none` (the spec's sample text said "Unaudited software" for both; the Stability Pool is a direct protocol call and its aside already says this).

- [ ] **Step 1: Write the failing tests**

```ts
it("says what each Trove action does", () => {
  for (const action of ["unwind", "close", "leverage", "open"] as const) expect(TROVE_CONNECT[action]).toMatch(/in one transaction.*EVM wallets only\.$/);
});
it("points at the facts", () => {
  expect(trustLine(lpSignFacts(mainnet, { feeBps: 10n, capMusd: 1000n * E, blockNumber: 1n }))).toBe("Unaudited software · cap 1,000 MUSD");
  expect(trustLine(spSignFacts(mainnet, 1n))).toBe("Mezo's contract; MezoRoute adds none");
  expect(trustLine(null)).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/leverage/connect-copy.test.ts src/lib/flow/sign-facts.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement both.**
- [ ] **Step 4: Wire the components.** `TroveAmountPage`: `<RequireWallet flow fallback={<ConnectPage back={{ href: "/", label: "Dashboard" }} step={1} title={TITLES[action].amount} cardTitle={TITLES[action].card} cardNote={TROVE_CONNECT[action]} />}>`. `BeforeYouSign`'s `Card` gets `id="before-you-sign"`. `LpEntryCard` and `SpEntryCard` take `trust?: string | null` and render, as the last child before the action, `<p className="text-xs text-muted lg:hidden">{trust} · <a href="#before-you-sign" className="font-medium text-accent underline underline-offset-2">Before you sign</a></p>`; the pages pass `trustLine(facts)`. `HeroFigures`: the two figures must not shrink below their text (`whitespace-nowrap` inside a `min-w-0` flex item overflows at 1024–1440 px); let the row wrap instead.
- [ ] **Step 5: Run** `npm test && npm run build` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(frontend): Trove connect pages, a trust line below lg, and the hero figure's width (U17)`.

---

### Task 13: Chart value labels clear of their line

**Files:**
- Modify: `frontend/src/lib/chart/move-chart.ts`, `frontend/src/lib/chart/move-chart.test.ts`, `frontend/src/components/chart/BtcMoveChart.tsx`

**Interfaces:**
- Produces:

```ts
export type LabelBox = { left: number; right: number; top: number; bottom: number };
/** The text box of a placed label: width = text.length × CHART_FONT_PX × 0.6 (Geist Mono's advance), height = CHART_FONT_PX. */
export function labelBox(label: ChartLabel & { y: number; anchor: "start" | "end" }, x: (move: number) => number, text: string): LabelBox;
/** True when the polyline crosses the box. */
export function labelHitsLine(box: LabelBox, points: { x: number; y: number }[]): boolean;
```

`placeLabels` returns each label's `anchor` as well as its `y`, and `BtcMoveChart` uses it for `textAnchor`.

- [ ] **Step 1: Write the failing test**: build the plot the way the file's existing `placeLabels` cases do, at widths 360 and 684, for (a) one LP series `MOVES.map((move) => ({ move, value: 970.06 * Math.sqrt(1 + move / 100) }))` with its baseline, and (b) LP `991 × √(1 + move/100)` beside a flat Stability Pool line at 1,000. For every placed label, `labelHitsLine(labelBox(label, x, labelText(...)), thatLabelsOwnSeriesInPixels)` is `false`, and every box stays inside the plot.
- [ ] **Step 2: Run** `npx vitest run src/lib/chart/move-chart.test.ts` — Expected: FAIL (today the −30% and Today labels sit on the rising line).
- [ ] **Step 3: Implement.** A rising line leaves the space above-left and below-right of a point free; choose the side and anchor from the series' slope at that point, and keep the existing rules for twins and the plot's edges.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `fix(frontend): chart value labels no longer sit on their own line (U17)`.

---

### Task 14: Verify in the browser and hand over

**Files:**
- Modify: `AGENTS.md` (Frontend section: one U17 paragraph), `docs/STATUS.md` (table row, session log), `docs/superpowers/specs/2026-11-12-u17-planner-risk-design.md` (the trust-line wording from Task 12; any tolerated read from Task 9)

- [ ] **Step 1:** `cd frontend && npm test && npm run build` — Expected: both pass; note the test count.
- [ ] **Step 2:** Build `main` to a second folder and run `npm run calldata-parity` with `CALLDATA_BASE`/`CALLDATA_HEAD` — Expected: 16/16.
- [ ] **Step 3:** Serve `frontend/out` and drive it with Playwright, no wallet, at 360, 390, 768, 1440 px, light and dark, testnet and mainnet. Expected on every page: no horizontal scroll, 0 console errors, one accent button. Re-observe each row of the review's table:
  - `/route/lp/?amount=1000`: the card shows BTC exposure with the −30% loss; "LP worth ≈ … MUSD"; on testnet the gap line; the aside's "You get" flips with the Staking switch; the chart's dashed line is at 1,000.
  - `/route/lp/?amount=5000` on mainnet: "above the cap" at the field, `aria-invalid="true"`, `Connect to review` enabled.
  - `/route/lp/?amount=abc-5`: the field error; the URL has no `amount`.
  - `/route/stability-pool/?amount=1000` and `/compare/?amount=250`: readable; the two planners' comparison rows are identical for 1,000 MUSD.
  - Landing: empty field shows the labelled 1,000 example; the testnet sentence is under the heading; "14.17M MUSD" fits at 1024 and 1440.
  - `/trove/unwind/`: h1, step, and the sentence.
  - 390 px: the trust line above the primary on both planners, and its link scrolls to "Before you sign".
- [ ] **Step 4:** Repeat the LP, Stability Pool, and Compare pages with the keyless mock wallet (`docs/STATUS.md` → QA accounts): connecting from each keeps the amount (Review Focus 5); the connected blocks and recoveries match a `main` build; Confirm shows "at the BTC price".
- [ ] **Step 5:** Update `AGENTS.md`, `docs/STATUS.md`, and the spec; commit `docs: U17 in AGENTS and STATUS`.
- [ ] **Step 6:** Whole-branch review by a fresh reviewer, then report to the user. Merging into `main` deploys production and waits for the user's word.
