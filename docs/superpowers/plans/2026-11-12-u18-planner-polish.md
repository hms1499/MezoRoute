# U18 Planner Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the two planners (`/route/lp/`, `/route/stability-pool/`) read consistently: one precision per unit, one framing per fact, a correct empty-state rate, a named Borrow & Deploy note, icons on warnings, and a short entry-gap line.

**Architecture:** Display-only changes. Pure helpers in `src/lib/flow/`, `src/lib/gauge/copy.ts` and `src/components/lp/` carry every rule and are unit-tested; components only place their output. No quote, gate, calldata, gas, or contract change.

**Tech Stack:** Next.js 14 static export, React 18, TypeScript, Vitest (`renderToStaticMarkup` for component tests), lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-12-u18-planner-polish-design.md`

## Global Constraints

- Planner precision: MUSD 2 decimals, LP 4, BTC 6 (BTC entries keep `btcFine`, 8), MEZO 2. Confirm, Positions, receipts keep `musd` (4) and `lp` (6).
- Rounding never flatters: balances and values truncate (`formatToken` default); costs and the gap round up (`"up"`).
- Grouping is display only: the URL, `intent.amount`, `parseMusdAmount`, and Max keep ungrouped digits.
- The Stability Pool never gets a rate, an APR, or the word "earn".
- Colour tokens unchanged; `contrast.test.ts`, `typography`, `icon-guard`, `colour-roles`, `layout`, `design-doc` guards must pass unchanged.
- Exact copy:
  - unconnected Borrow note: `Borrow & Deploy needs a connected wallet with a Trove.`
  - gap line: `≈ {amount} MUSD ({percent}) below what you put in`
  - gap row: label `Below what you put in`, value `≈ {amount} MUSD ({percent})`, sub `at the BTC price: ` + `ENTRY_GAP_CAUSE`
  - header without APR while staked: label `Staked LP earns`, value `MEZO`
  - exposure sub: `If BTC −30%: ≈ {valueAfterDrop} MUSD (−{lossAfterDrop})`
- Commits: conventional prefixes (`feat(frontend):`, `test(frontend):`, `docs:`), each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Typing and pasting into the amount field: focus shows the raw text, blur shows it grouped; pasting `1,000.5` yields `1000.5` in the URL; the caret never jumps (Task 6 pins strip/group; QA step in Task 8 checks the caret).
2. Malformed text (`1.2.3`, `abc`, `.`) shows exactly as typed next to its field error, never reformatted (Task 6).
3. A tiny figure at 2 decimals (a 1 MUSD deposit's 0.001 MUSD fee) reads `<0.01 MUSD`, never `0 MUSD` (Task 1).
4. Empty field with Staking on: the header no longer names a swap fee and the comparison shows a MEZO rate for the 1,000 example on both planners (Tasks 3 and 7).
5. A BTC entry: the header follows the stake rules, the exposure row keeps "pool share only", the comparison keeps its MUSD-only message (Tasks 2 and 3).

---

### Task 1: Planner precision helpers and MEZO at 2 decimals

**Files:**
- Modify: `frontend/src/components/lp/units.ts`
- Modify: `frontend/src/lib/gauge/copy.ts` (`stakeLines`, `stakeOffLine`)
- Test: `frontend/src/components/lp/units.test.ts`, `frontend/src/lib/gauge/copy.test.ts`

**Interfaces:**
- Produces: `musdShort(value: bigint): string` (`formatToken(value, 18, 2)` + ` MUSD`), `lpShort(value: bigint): string` (`formatToken(value, 18, 4)` + ` LP`).

- [ ] **Step 1: Write the failing tests**

```ts
describe("planner precision", () => {
  it("truncates MUSD to 2 and LP to 4", () => {
    expect(musdShort(961_077_123_000_000_000_000n)).toBe("961.07 MUSD");
    expect(lpShort(1_782_558_900_000_000_000n)).toBe("1.7825 LP");
  });
  it("never shows a non-zero amount as 0", () => {
    expect(musdShort(10n ** 15n)).toBe("<0.01 MUSD");
  });
});
```

In `copy.test.ts`, change the open-week expectation to 2 decimals: `stakeLines("open", 1_500_000_000_000_000_000n)` starts `≈ 1.5 MEZO a week`, and add `stakeLines("open", 144_033_100_000_000_000_000n)[0]` starts `≈ 144.03 MEZO a week`; the off line for the same value contains `≈ 144.03 MEZO a week`.

- [ ] **Step 2: Run** `cd frontend && npx vitest run src/components/lp/units.test.ts src/lib/gauge/copy.test.ts` — expect FAIL (`musdShort` not exported; `144.0331`).
- [ ] **Step 3: Implement** the two helpers in `units.ts`; change both `formatToken(mezoPerWeek, 18, 4)` in `copy.ts` to `18, 2`.
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** `feat(frontend): planner precision helpers, MEZO a week at 2 decimals`

---

### Task 2: Gap line, shared gap row, and LP/SP card rows at planner precision

**Files:**
- Modify: `frontend/src/lib/flow/entry-worth.ts` (`entryGapLine`, new `entryGapRow`)
- Modify: `frontend/src/components/lp/entry-rows.ts` (`lpExposureRow`, `priceImpactRow`, `lpReceive`)
- Modify: `frontend/src/components/lp/ConfirmSummary.tsx:50` (use `entryGapRow`)
- Modify: `frontend/src/components/stability-pool/entry-rows.ts` (`musd` → `musdShort`)
- Test: `frontend/src/lib/flow/entry-worth.test.ts`, `frontend/src/components/lp/entry-rows.test.ts`, `frontend/src/components/lp/confirm-summary.test.ts`, `frontend/src/components/stability-pool/entry-rows.test.ts`

**Interfaces:**
- Consumes: `musdShort`, `lpShort` (Task 1).
- Produces:
  - `entryGapLine(worth: EntryWorth): string | null` (the `putInLabel` parameter is removed)
  - `entryGapRow(worth: EntryWorth): { label: string; value: string; sub: string; tone: "warning" } | null`
  - `lpReceive(input: { worth; liquidity; minLpOut }): { value; minimum; note }` (`putInLabel` removed)

- [ ] **Step 1: Write the failing tests**
  - `entryGapLine(w)` for the existing fixture (200 put in, worth 190) equals `≈ 10 MUSD (5%) below what you put in`.
  - `entryGapRow(w)` equals `{ label: "Below what you put in", value: "≈ 10 MUSD (5%)", sub: \`at the BTC price: ${ENTRY_GAP_CAUSE}\`, tone: "warning" }`; null when `entryGap` is null.
  - `lpExposureRow({ exposureChange: E/10n, worth: w, fromBtc: false }).sub` equals `` `If BTC −30%: ≈ ${formatToken(w.valueAfterDrop, 18, 2)} MUSD (−${formatToken(w.lossAfterDrop, 18, 2, "up")})` ``.
  - `lpReceive(...)` value `LP worth ≈ ${musdShort(w.value)}`, minimum `≈ ${lpShort(liquidity)} · at least ${lpShort(minLpOut)}`.
  - The `priceImpactRow` cost for a MUSD entry uses `musdShort`.
  - The Confirm summary test still finds `Below what you put in` with the full cause in its sub (unchanged output).
  - The SP rows test expects `musdShort` values for `Deposit after (estimated)` and `Your deposit now`.
- [ ] **Step 2: Run** `npx vitest run src/lib/flow/entry-worth.test.ts src/components/lp src/components/stability-pool` — expect FAIL on the new strings.
- [ ] **Step 3: Implement.** `entryGapRow` builds from `entryGap(worth)`; `ConfirmSummary` spreads `{ group: "You receive", ...row }`. Update the `lpReceive` caller in `LpRoutePage.tsx` to drop `putInLabel`.
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** `feat(frontend): short entry-gap line, shared gap row, planner precision on card rows`

---

### Task 3: Header that does not depend on the amount

**Files:**
- Modify: `frontend/src/lib/flow/lp-entry.ts` (`lpHeaderFigure`)
- Modify: `frontend/src/components/lp/LpRoutePage.tsx` (call site: drop `weekly`)
- Test: `frontend/src/lib/flow/lp-entry.test.ts`

**Interfaces:**
- Produces: `lpHeaderFigure(input: { stakeOn: boolean; availability: StakeAvailability; apr: bigint | null; poolFeeBps: bigint }): { label: string; value: string }`.

- [ ] **Step 1: Write the failing tests** (replace the "MEZO amount without a MEZO price" case):
  - staked, `open`, APR known → `{ label: "At this week's rate", value: "≈ 41.2% APR" }` (unchanged)
  - staked, `open`, `apr: null` → `{ label: "Staked LP earns", value: "MEZO" }`
  - off, or `between-weeks`, or `unavailable` → `{ label: "Pool", value: "0.3% swap fee" }` for `poolFeeBps: 30n`
  - the existing "never says $ or earn" test: keep it for the APR and Pool cases; the staked-no-APR label says "earns" by spec, so assert that case separately and assert no `$` anywhere.
- [ ] **Step 2: Run** `npx vitest run src/lib/flow/lp-entry.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** and update the call in `LpRoutePage.tsx`.
- [ ] **Step 4: Run** — expect PASS; `npx tsc --noEmit -p .` shows no new errors.
- [ ] **Step 5: Commit** `feat(frontend): planner header never shows the amount-dependent MEZO a week`

---

### Task 4: Icons on warnings, and the gap line's Why link

**Files:**
- Modify: `frontend/src/components/flow/ReceiveRow.tsx` (note: `CircleAlert` before it; new optional `noteAction?: ReactNode` rendered after ` · `)
- Modify: `frontend/src/components/flow/Overview.tsx` (`tone: "warning"` rows: `CircleAlert` before the value)
- Modify: `frontend/src/components/lp/LpEntryCard.tsx` (pass `noteAction` = `<a href="#details">Why</a>` with the risk line's link classes when `receive.note` is set)
- Test: `frontend/src/components/flow/card.test.ts`, `frontend/src/components/lp/lp-route.test.ts`

- [ ] **Step 1: Write the failing tests**
  - Rendering `Overview` with one `tone: "warning"` row and one `tone: "btc"` row: the markup contains exactly one `lucide-circle-alert` svg with `aria-hidden="true"` and class `h-4 w-4`.
  - Rendering `ReceiveRow` with `note` contains the icon before the note text; with `noteAction` contains ` · ` then the action.
  - The LP card render with a gap note contains `href="#details"` and `>Why</a>`.
- [ ] **Step 2: Run** `npx vitest run src/components/flow src/components/lp` — expect FAIL.
- [ ] **Step 3: Implement.** Icon `className="h-4 w-4 shrink-0"`, `aria-hidden`, placed inline-flex with the text so it wraps with it.
- [ ] **Step 4: Run** the same tests plus `npx vitest run src/lib/ui` (guards) — expect PASS.
- [ ] **Step 5: Commit** `feat(frontend): warnings carry an icon; the gap line links to its causes`

---

### Task 5: Borrow & Deploy note names its tab

**Files:**
- Modify: `frontend/src/components/lp/ModeToggle.tsx` (`CONNECT_TO_BORROW`)
- Test: `frontend/src/components/lp/mode-toggle.test.ts`

- [ ] **Step 1: Update the tests**: unconnected markup contains `Borrow &amp; Deploy</` inside the term and ` needs a connected wallet with a Trove.`; the connected test asserts `not.toContain("needs a connected wallet")`.
- [ ] **Step 2: Run** `npx vitest run src/components/lp/mode-toggle.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the new constant (the existing `withTerm` wraps the label).
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `fix(frontend): the unconnected Borrow & Deploy note names its tab`

---

### Task 6: Grouped amount field

**Files:**
- Create: `frontend/src/lib/flow/group-amount.ts`
- Modify: `frontend/src/components/flow/TokenAmountInput.tsx` (amount mode `<input>` only)
- Test: `frontend/src/lib/flow/group-amount.test.ts`, `frontend/src/components/flow/flow.test.ts`

**Interfaces:**
- Produces: `groupAmount(text: string): string`, `stripGrouping(text: string): string`.

- [ ] **Step 1: Write the failing tests**
  - `groupAmount`: `"1000"` → `"1,000"`; `"12345.67"` → `"12,345.67"`; `"1000."` → `"1,000."`; `".5"` → `".5"`; `"999"` → `"999"`; `""` → `""`; `"1.2.3"`, `"abc"`, `"."`, `"1,000"` unchanged.
  - `stripGrouping`: `"1,000.5"` → `"1000.5"`; `"1000"` unchanged; `"a,b"` → `"ab"`.
  - The `TokenAmountInput` render with `amount: "1000"` (not focused: static render) has `value="1,000"`.
- [ ] **Step 2: Run** `npx vitest run src/lib/flow/group-amount.test.ts src/components/flow/flow.test.ts` — expect FAIL.
- [ ] **Step 3: Implement.** `groupAmount` groups only text matching `/^\d+(\.\d*)?$/`. In the input: a `focused` state from `onFocus`/`onBlur`; `value={focused ? amount : groupAmount(amount)}`; `onChange` passes `stripGrouping(event.target.value)` to `onAmount`. Focused text is never reformatted, so the caret stays where the browser put it.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(frontend): group the amount field's digits when it is not being edited`

---

### Task 7: The LP comparison rates the amount it compares

**Files:**
- Modify: `frontend/src/lib/flow/planner-comparison.ts` (new `plannerLpSide`)
- Modify: `frontend/src/components/lp/LpRoutePage.tsx`, `frontend/src/components/stability-pool/SpRoutePage.tsx` (both use `plannerLpSide`)
- Test: `frontend/src/lib/flow/planner-comparison.test.ts`

**Interfaces:**
- Produces: `plannerLpSide(input: { pool: PoolState; price: bigint; amountMusd: bigint; executorFeeBps: bigint; gauge: Pick<GaugeState, "rewardRate" | "totalStaked"> | null; availability: StakeAvailability; mezoPrice: bigint | null }): { lp: PlannerLp | null; apr: bigint | null; weekly: bigint | null }` = `plannerLpFigures` then `lpWeekRate` with its liquidity.

- [ ] **Step 1: Write the failing tests**
  - With an open gauge, `mezoPrice: null`, and the 1,000 MUSD example amount: `weekly` is non-null and > 0, and `plannerComparisonRows({ ..., weekly, apr })`'s LP "This week" value matches `/^≈ [\d,.]+ MEZO a week$/`.
  - For a typed amount, `plannerLpSide(...).lp.liquidity` equals `quoteEntry(pool, amount, fee).liquidity` (card parity).
- [ ] **Step 2: Run** `npx vitest run src/lib/flow/planner-comparison.test.ts` — expect FAIL (`plannerLpSide` not exported).
- [ ] **Step 3: Implement**, then wire both pages: `LpRoutePage` passes `plannerLpSide(...)`'s `apr`/`weekly`/`lp` to `plannerComparisonRows` (the card's Staking row keeps its own `lpWeekRate` from the card quote); `SpRoutePage` replaces its inline `plannerLpFigures` + `lpWeekRate`.
- [ ] **Step 4: Run** `npx vitest run src/lib/flow src/components/lp src/components/stability-pool` — expect PASS.
- [ ] **Step 5: Commit** `fix(frontend): the LP planner's comparison rates its example amount`

---

### Task 8: Page wiring, the gap row in Details, full verification, STATUS

**Files:**
- Modify: `frontend/src/components/lp/LpRoutePage.tsx` (card rows use `musdShort`/`lpShort` where Task 2 did not reach: `Deposited to the pool`, `MezoRoute fee` for MUSD entries; `context` starts with `entryGapRow(worth)` when non-null)
- Modify: `docs/STATUS.md`
- Test: `frontend/src/components/lp/lp-route.test.ts`

- [ ] **Step 1: Write the failing test**: the LP page's Details content, for a quote with a ≥1% gap, contains `Below what you put in` before `Network fee`.
- [ ] **Step 2: Run** `npx vitest run src/components/lp/lp-route.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the wiring.
- [ ] **Step 4: Run the whole suite and build:** `cd frontend && npm test && npm run build` — expect every test PASS and the build (lint, types, postbuild checks) to succeed. Record the test count.
- [ ] **Step 5: Calldata parity:** build `main` into a second export, serve both, run `CALLDATA_BASE=<main url> CALLDATA_HEAD=<branch url> npm run calldata-parity` — expect every flow to match.
- [ ] **Step 6: Playwright QA** on the served export, no wallet, testnet, at 1440 and 375 px:
  - `/route/lp/` empty: the header says `Staked LP earns · MEZO`, and the aside shows `≈ … MEZO a week` for the 1,000 example.
  - `?amount=1000`: the field shows `1,000`, and focusing it shows `1000`. Type `2500` and blur: the URL is `amount=2500`. Paste `1,000.5`: the URL is `amount=1000.5`.
  - Card figures: 2-decimal MUSD, 4-decimal LP; the Staking row says `144.03`.
  - The exposure sub reads `If BTC −30%: ≈ … MUSD (−…)`. The gap line is one sentence with an icon and `Why`, and `Why` opens Details on `Below what you put in`.
  - The Borrow note names the tab.
  - `/route/stability-pool/?amount=1000`: the field is grouped and the aside rate is shown.
  - No horizontal scroll at 375 px.
- [ ] **Step 7: Update `docs/STATUS.md`**:
  - set U18 as done on its branch;
  - add a session-log line with the test count, the parity result, and the QA result.
- [ ] **Step 8: Commit** `docs: U18 built, tested, and QA'd`
