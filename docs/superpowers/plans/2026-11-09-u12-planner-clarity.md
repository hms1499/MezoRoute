# U12 Planner Clarity: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the LP planner (`/route/lp/`) state in one screen what the user is about to do and what they get, and make its primary action always do the thing that unblocks them. Fix the small defects the 9 Nov UI review found; do not add new product surfaces.

**Authority:** This plan implements the "cần fix" part of the 9 Nov 2026 UI review (the recommendations discussed in chat) against `frontend/DESIGN.md`, which stays the binding UI authority. Where the review and DESIGN.md disagree, DESIGN.md wins. No new spec is written because every task either restores a rule DESIGN.md already states (a full sentence is at least 14 px, one primary per view, the minimum is visible before Review) or fixes a defect (Max fills 18 decimals, `#details` does not open).

**Scope:** six defects, one editorial fix, one QA pass:

1. Max fills wei-precision text instead of a readable amount.
2. Percent mode's `<output>` is not associated with its label.
3. A blocked page shows a dead "Review" while the way out sits in a notice above it.
4. The minimum received and the risk line are 12 px, below the size DESIGN.md gives a sentence, and the risk line is centred.
5. The card's "Details" link scrolls to a closed `<details>`.
6. The amount card's overview is up to eight rows long; context rows move into Details.
7. The LP page's `h1` is a marketing sentence that takes three lines at 360 px.

**Out of scope (recorded so no task drifts into them):** a read-only planner before connecting a wallet (product change, needs its own spec), a CR meter on Borrow & Deploy, "share of pool" copy, merging the Dashboard's three snapshots onto one block (architecture change), a Trove hub page (no such route exists yet), one shared `formatAmount` helper (repository-wide refactor), the Token menu's per-token balances (needs both balances threaded through the field for a menu that is closed in static markup).

**Architecture:**

- Pure formatting/selection helpers go in `src/lib/flow/` (`amount.ts`, `notice-action.ts`) so the pages stay compositions and the rules are unit-testable.
- Component changes stay inside `src/components/flow/` and `src/components/lp/`, except the optional `subtitle` on `PageHeader`.
- Nothing under `src/lib/tx/`, `src/lib/quote/`, the `trove/`/`gauge/` maths, or `src/lib/routes/` changes. Transaction payloads are untouched, so `npm run calldata-parity` is not needed; the review's promise "no change to how transactions are built" still holds.

**Tech Stack:** Next 14.2.35 static export, React 18.3.1, Tailwind 3, Vitest 5.0.3 (node environment; component tests use `renderToStaticMarkup`), lucide-react, Playwright 1.56.1 for QA. Nothing is upgraded and no dependency is added.

**Branch:** `feat/u12-planner-clarity`. Merge into `main` only on the user's word (a push deploys production).

## Global Constraints

- Read `frontend/DESIGN.md` before Task 1. Its tokens and guards are the source of truth: one primary button per view, `text-sm` for every full sentence, one `text-title` `h1` per page, no hex, no off-scale spacing, no shadow outside overlays.
- Copy rules stay: this week's rate, swap fees go to veBTC voters while staked, no "guaranteed", no "≈ $", never annualise the Stability Pool.
- Every risk visible today stays visible before signing: the amount page keeps its one risk line plus Details; Confirm keeps the full list always open.
- Do not touch any file under `frontend/src/lib/{tx,quote,routes}`, the `trove/` and `gauge/` maths, or `positions/exit*`.
- Before every commit: `cd frontend && npm test && npm run build`. Both must pass (the build runs lint and the type check). Never run `next build` while `next dev` runs.
- Conventional commits. Never push `main`; nothing is merged in this plan without the user's word.
- QA follows `AGENTS.md`: `npm run build`, serve `frontend/out` on loopback, drive it with Playwright and the keyless mock EIP-1193 wallet. Restart the static server after each rebuild.

## Review Focus

1. **The blocked page must have exactly one accent button.** If Task 3 doubles an action (one in the notice, one as the primary), the page has two competing CTAs. Owned by Task 3's render test (`match(/bg-accent(?![\w-])/g)` has length 1) and the Playwright check.
2. **Max must never round up.** A filled amount above the balance would block the page with "insufficient balance" right after the user pressed Max. The helper floors; owned by Task 1's `1234.999999999…` case.
3. **No risk disappears.** Moving rows into Details (Task 6) keeps them in the DOM and on Confirm; the one risk line (Task 4) is still above Review.
4. **Hash opening must not fight the user.** `Details` opens when the card's link is used; it must still close normally and must not re-open on unrelated hash changes. Owned by Task 5's pure helper and the Playwright check.

---

## Task 1: Max fills a readable, floored amount

**Files:**
- Modify: `frontend/src/lib/flow/amount.ts`, `frontend/src/lib/flow/amount.test.ts`, `frontend/src/components/flow/TokenAmountInput.tsx`

**Interfaces:**
- Produces:
  ```ts
  /** Digits Max fills: the precision each flow already shows (MUSD 4, BTC 8, MEZO 4, LP 6), so no 18-decimal dust. */
  export const MAX_FILL_DIGITS: Record<FlowToken, number> = { musd: 4, btc: 8, mezo: 4, lp: 6 };
  /** The balance as an input value, floored to MAX_FILL_DIGITS and stripped of trailing zeros. `0n` is "0". */
  export function maxFillAmount(max: bigint, token: FlowToken): string;
  ```
- Consumes: `FlowToken` from the same module; viem's `formatUnits`.

- [ ] **Step 1: Write the failing tests** in `amount.test.ts`:
  - `it("floors Max to the token's shown precision")`: `maxFillAmount(1234_5678_9123_4567_8912_345n, "musd")` equals `"1234.5678"`; `maxFillAmount(123_456_789_123_456_789n, "btc")` equals `"0.12345678"`; `maxFillAmount(1234_9999_9999_9999_9999n, "musd")` equals `"1234.9999"` (never rounds up).
  - `it("drops trailing zeros")`: `maxFillAmount(10n * 10n ** 18n, "musd")` equals `"10"`; `maxFillAmount(1_5000_0000_0000_0000n, "btc")` equals `"0.15"`.
  - `it("keeps zero")`: `maxFillAmount(0n, "musd")` equals `"0"`.
  - `it("never returns more precision than MAX_FILL_DIGITS")`: for each token, the fraction length of `maxFillAmount(10n ** 18n - 1n, token)` is at most `MAX_FILL_DIGITS[token]`.
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/lib/flow/amount.test.ts`. Expected: FAIL (`maxFillAmount` is not exported).
- [ ] **Step 3: Implement.** Floor with `const step = 10n ** BigInt(18 - MAX_FILL_DIGITS[token]); const floored = (max / step) * step;`, format with `formatUnits(floored, 18)`, and strip `/(\.\d*?)0+$/` then a trailing `"."`. Do not use `formatToken` (it groups thousands and prints `<0.000001`, neither of which belongs in an input).
- [ ] **Step 4: Use it in `TokenAmountInput`.** Replace `onAmount(formatUnits(max, 18))` with `onAmount(maxFillAmount(max, token))`; drop the now-unused `formatUnits` import.
- [ ] **Step 5: Run** `npx vitest run src/lib/flow/amount.test.ts src/components/flow/flow.test.ts`. Expected: PASS.
- [ ] **Step 6: Commit** `fix(frontend): Max fills a readable amount`.

## Task 2: Percent mode associates its label with its output

**Files:**
- Modify: `frontend/src/components/flow/TokenAmountInput.tsx`, `frontend/src/components/flow/flow.test.ts`

**Interfaces:**
- The label always carries `id={`${id}-label`}`. The text input keeps `htmlFor={id}`. The percent-mode `<output id={id}>` gets `aria-labelledby={`${id}-label`}`.

- [ ] **Step 1: Write the failing tests** in `flow.test.ts`:
  - `it("labels the percent output")`: render with `percent: { value: 50, presets: [25, 50, 75, 100], onPreset: () => undefined }`; expect `out` to match `/<label[^>]*id="amount-label"/` and `/<output[^>]*id="amount"[^>]*aria-labelledby="amount-label"/`.
  - `it("keeps the input's htmlFor")`: the plain render still matches `/<label[^>]*for="amount"/`.
- [ ] **Step 2: Run** `npx vitest run src/components/flow/flow.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the two attributes; in percent mode keep `htmlFor` undefined (there is no input to point at).
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `fix(frontend): associate the percent label with its output`.

## Task 3: A blocked page's primary action is the way out

**Files:**
- Create: `frontend/src/lib/flow/notice-action.ts`, `frontend/src/lib/flow/notice-action.test.ts`
- Modify: `frontend/src/components/lp/BlockNotice.tsx`, `frontend/src/components/lp/LpEntryCard.tsx`, `frontend/src/components/lp/LpRoutePage.tsx`, `frontend/src/components/lp/lp-route.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type NoticeAction = { label: string; onClick?: () => void; href?: string };
  /** The first action becomes the page's primary; the rest stay in the notice. */
  export function splitPrimary(actions: readonly NoticeAction[]): { primary: NoticeAction | null; rest: NoticeAction[] };
  ```
- `BlockNotice` imports the type from `lib/flow/notice-action` instead of declaring its own (its `balanceNoticeActions` return type changes to the imported one; behaviour is unchanged).
- `LpEntryCard`'s `review: { href: string; disabled: boolean }` becomes:
  ```ts
  action: { label: ReactNode; href?: string; onClick?: () => void; external?: boolean; disabled?: boolean };
  ```
  Render it as the single primary: `href` and not disabled → `ButtonLink` (`external` when the recovery leaves the app); `onClick` → `Button`; disabled → inert `ButtonLink` with `disabled`. `arrow` is on unless the action leaves the app, and never when disabled.
- `LpRoutePage` computes `const { primary, rest } = splitPrimary(recoveries)` and passes `action` as:
  - `primary` exists → `{ label: primary.label, href: primary.href, onClick: primary.onClick, external: primary.href !== undefined }`;
  - otherwise → `{ label: "Review", href: reviewHref, disabled: preview.block !== null }`.
  `BlockNotice` receives `actions={rest}`.
- The page keeps exactly one accent button: the primary. The notice's remaining actions stay `secondary`.

- [ ] **Step 1: Write the failing tests.**
  - `notice-action.test.ts`: `splitPrimary([])` equals `{ primary: null, rest: [] }`; with `[a, b]` returns `{ primary: a, rest: [b] }`; the input array is not mutated.
  - `lp-route.test.ts` (update the fixture to `action: { label: "Review", href: "/route/lp/confirm/?amount=1" }`):
    - existing "has one primary button, Review" still passes;
    - `it("makes the way out the primary when a recovery is offered")`: with `action: { label: "Borrow & Deploy instead", onClick: () => undefined }`, exactly one `bg-accent`, the markup contains `Borrow & Deploy instead`, and does not contain `>Review<`;
    - `it("renders a disabled primary inert")`: with `action: { label: "Review", href: "#", disabled: true }`, the markup contains `aria-disabled="true"` and no `href="#"`;
    - `it("keeps an external recovery out of the arrow")`: with `action: { label: "Get test BTC", href: "https://faucet.test.mezo.org", external: true }`, the markup contains `target="_blank"` and no `btn-circle`.
- [ ] **Step 2: Run** `npx vitest run src/lib/flow/notice-action.test.ts src/components/lp/lp-route.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the helper, then the prop and the page mapping. In `LpRoutePage` the CTA derivation sits next to `recoveries`, and `Review` keeps the same `entryQuery(intent)` href it has today for both the amount and confirm pages.
- [ ] **Step 4: Run** both tests, then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(frontend): make the blocked CTA the way out`.

## Task 4: The minimum and the risk line get the sentence size

**Files:**
- Modify: `frontend/src/components/flow/ReceiveRow.tsx`, `frontend/src/components/flow/ActionCard.tsx`, `frontend/src/components/flow/flow.test.ts`

**Interfaces:**
- `ReceiveRow`'s minimum line: `text-sm text-muted` (was `text-xs`), still under the figure.
- `ActionCard`'s risk line: `text-left text-sm text-muted` (was `text-center text-xs`), so a full risk sentence follows DESIGN.md's 14 px floor and the "Details" link aligns with the sentence it belongs to.

- [ ] **Step 1: Write the failing tests** in `flow.test.ts`:
  - `it("gives the minimum the sentence size")`: render `ReceiveRow` with `minimum: "At least 0.9 LP"`; expect the markup to match `/<p class="mt-0\.5 text-sm text-muted">At least 0\.9 LP<\/p>/`.
  - `it("left-aligns the risk line at the sentence size")`: render `ActionCard` with one child and `risk: "Impermanent loss and MEZO price risk"`; expect `out` to match `/<p class="text-left text-sm text-muted">/` and not to contain `text-center text-xs`.
- [ ] **Step 2: Run** `npx vitest run src/components/flow/flow.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the two class changes. Do not change `Overview`'s `sub` line (12 px is correct for a caption) and do not add colour to the risk line.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `fix(frontend): show the minimum and the risk at sentence size`.

## Task 5: "Details" opens the details

**Files:**
- Create: `frontend/src/lib/ui/hash-target.ts`, `frontend/src/lib/ui/hash-target.test.ts`
- Modify: `frontend/src/components/flow/Details.tsx`

**Interfaces:**
- Produces: `export function isHashTarget(hash: string, id: string): boolean` — true only for `#<id>` (exact, after decoding; `"#details-2"`, `"#details "`, and `""` are false).
- `Details` becomes a client component. A `useRef<HTMLDetailsElement>` plus one `useEffect`:
  - on mount, open when `isHashTarget(window.location.hash, id)`;
  - listen to `hashchange` and open on a match;
  - listen to `click` on the document and open when the clicked anchor's `hash` is this id (the same hash does not fire `hashchange`, so a second click after closing still works).
  It never closes the element itself: the user's own toggle stays authoritative.

- [ ] **Step 1: Write the failing test** `hash-target.test.ts`: `isHashTarget("#details", "details")` true; `isHashTarget("#details-2", "details")` false; `isHashTarget("", "details")` false; `isHashTarget("#det%61ils", "details")` true (the browser decodes).
- [ ] **Step 2: Run** `npx vitest run src/lib/ui/hash-target.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the helper, then the effect in `Details` (`"use client"`, refs, listeners removed on cleanup). Keep the `open={defaultOpen || undefined}` initial attribute so a `defaultOpen` page still renders open without JS.
- [ ] **Step 4: Run** the test, then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(frontend): open Details from its hash link`.

## Task 6: The amount card keeps four decision rows

**Files:**
- Modify: `frontend/src/components/lp/LpEntryCard.tsx`, `frontend/src/components/lp/LpRoutePage.tsx`, `frontend/src/components/lp/lp-route.test.ts`

**Interfaces:**
- `LpEntryCard` gains `context?: OverviewRow[]`, rendered as the first block inside `<Details>` (above `EntryPreviewCard`), so the rows are still read before signing but only when asked.
- `LpRoutePage` keeps in `overview`: "Deposited to the pool", "MezoRoute fee", "Price impact", "Staking". It moves to `context`: "BTC exposure", the `troveChangeRows(...)` rows, and "Network fee".
- Confirm is untouched: `ConfirmSummary` keeps every amount, minimum, fee, and deadline row.

- [ ] **Step 1: Write the failing tests** in `lp-route.test.ts`:
  - `it("keeps the card to the decision rows")`: render with `overview` of the four rows and `context: [{ label: "Network fee", value: "0.00001 BTC" }]`; expect exactly 4 `<dt>` before `id="details"` and that `out.indexOf("Network fee") > out.indexOf('id="details"')`.
  - `it("renders no empty overview box in Details")`: with `context: []`, the details section contains no extra `<dl>` (count `<dl` equals 1).
- [ ] **Step 2: Run** `npx vitest run src/components/lp/lp-route.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the prop and the page's row split. Keep the existing order inside `context` (BTC exposure, Trove rows, network fee) and keep every row's `sub` and `tone`.
- [ ] **Step 4: Run** the test, then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(frontend): move context rows into Details`.

## Task 7: A short page title with the long sentence as its subtitle

**Files:**
- Modify: `frontend/src/components/ui/PageHeader.tsx`, `frontend/src/components/lp/LpRoutePage.tsx`
- Create: `frontend/src/components/ui/PageHeader.test.ts`

**Interfaces:**
- `PageHeader` gains `subtitle?: ReactNode`, rendered under the `h1` as `<p className="text-sm text-muted">`. It is not part of the heading, so the accessible name stays short.
- The LP page becomes `title="Add liquidity"` and `subtitle="Earn swap fees or MEZO in the MUSD/BTC pool"`.
- Every other `PageHeader` call site is unchanged (no subtitle, same `h1`).

- [ ] **Step 1: Write the failing test** `PageHeader.test.ts`: render `PageHeader` with `back`, `step: 1`, `title: "Add liquidity"`, `subtitle: "Earn swap fees or MEZO in the MUSD/BTC pool"`; expect `<h1 class="text-title [text-wrap:balance]">Add liquidity</h1>` and a `<p class="text-sm text-muted">` with the sentence; expect the `h1` not to contain the sentence.
- [ ] **Step 2: Run** `npx vitest run src/components/ui/PageHeader.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the optional subtitle and the LP page call. Check the SP route and Confirm pages still render one short `h1`; change nothing there.
- [ ] **Step 4: Run** the test, then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(frontend): a short LP page title`.

## Task 8: QA, docs, and the branch hand-off

**Files:**
- Modify: `frontend/DESIGN.md` (only if a token/role changed — it does not; skip when unchanged), `docs/STATUS.md`, `AGENTS.md` (one line under the LP route rules)

- [ ] **Step 1: Run the full gate** `cd frontend && npm test && npm run build`. Expected: PASS; record the Vitest count and the First Load JS.
- [ ] **Step 2: Serve and drive** `frontend/out` with the mock wallet (testnet):
  - `/route/lp/` at 360, 768, 1440 px, light and dark: no horizontal scroll, 0 console errors;
  - the `h1` reads "Add liquidity" and is at most two lines at 360 px;
  - with the funded QA account: press Max on BTC — the field shows at most 8 decimals and Review stays enabled; the minimum line is 14 px;
  - with the no-MUSD account (`0xe37c0e20cf9f466e869a9e20ffbe66333b8f6b74`): the primary button is the recovery action ("Borrow & Deploy instead" / "Use my balance" / "Get MUSD in the Mezo app"), not a dead Review, and the notice lists no duplicate of it;
  - click the card's "Details" link: `document.querySelector("details#details").open === true`, and clicking it again after closing re-opens it;
  - `/route/lp/confirm/` and `/route/stability-pool/` are visually unchanged apart from the 14 px risk line.
- [ ] **Step 3: Update docs.** `docs/STATUS.md`: table row for U12 (done, branch, test counts) and one session-log line. `AGENTS.md`: one sentence under the LP route bullet: the amount page's primary is the unblock action when the entry is blocked, and Max floors to the token's shown precision.
- [ ] **Step 4: Commit** `docs: record U12` and hand the branch over. Do not merge or push; a merge into `main` deploys production and needs the user's word.

---

## Verification summary

| Check | Command | Expected |
|---|---|---|
| Unit and component tests | `cd frontend && npm test` | PASS, no test deleted or weakened |
| Build, lint, types | `cd frontend && npm run build` | PASS |
| Planner at 360/768/1440, both themes | Playwright against `out/` | no horizontal scroll, 0 console errors |
| Blocked page | no-MUSD account | one accent CTA, and it unblocks |
| Details deep link | click the risk line's link | the disclosure is open |
| Transaction payloads | — | untouched by construction (no file under `tx/`, `quote/`, `routes/`) |
