# U13 Read-only Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a visitor with no wallet see the live MUSD/BTC LP quote, the risks, and a Stability Pool comparison on `/route/lp/`, with `Connect to review` as the page's only primary action.

**Architecture:** `LpRoutePage` stops wrapping itself in `RequireWallet`: it reads `useAccount()` itself and passes `account: Address | undefined` down. `useLpRouteSnapshot` reads every account-scoped call with the zero address while unconnected and skips the gas-balance query; `entryPreview` then quotes normally, and the page ignores its gate while unconnected through one pure helper (`plannerView`). A 340 px aside from `lg` carries two new presentational cards: the LP/Stability Pool comparison and `Before you sign`.

**Tech Stack:** Next 14 static export, React 18, wagmi 2, viem 2, Tailwind (token-only classes), Vitest 5 with `react-dom/server` for component tests.

**Spec:** `docs/superpowers/specs/2026-11-09-u13-readonly-planner-design.md`

**Mockup:** `docs/superpowers/mockups/2026-11-09-u13-planner.html`

## Global Constraints

- No new dependency; no contract change.
- No file under `src/lib/{tx,quote}` changes.
- Copy: never `earn`, `guaranteed`, `risk-free`, `≈ $`; the Stability Pool never gets an APR, a percentage, or a projection. `Unaudited software` stays visible before connection.
- One accent (`bg-accent`) primary per view: Connect, or Review, or one recovery — never two.
- Design system: no new colour, radius, shadow, spacing step, or font. Only `Card`, `Button`/`ButtonLink`, `Badge`, `Term`, `Settle`, `.hit`, and the existing `accent`/`sp` tokens.
- One `h1` per page (`PageHeader` in `LpRoutePage`).
- Run `cd frontend && npm test` for tests and `cd frontend && npm run build` for the build (build includes lint and type check).
- Commit prefixes: `feat(frontend):`, `fix(frontend):`, `test(frontend):`, `docs:`.

## Review Focus

- **An amount above any wallet's balance.** The planner must quote it, show the cap, and show no "insufficient balance" notice until a wallet is connected; a reasonable visitor reads a quote as a quote, not as a gate.
- **A remembered wallet on reload.** The page must show `LoadingCard` while `status === "reconnecting"`, never flash `Connect to review` at a wallet that is already connected.
- **A failed gauge read.** `gauge: null` must degrade to `Swap fees` / `Pool fee …` in the comparison, never to an APR, a crash, or a `0` rate.
- **Invalid amount text** (`abc`, `.`, `0`). The comparison says `Enter a valid amount to compare.` with no Stability Pool link, and Connect still opens the wallet modal.
- **`asset=btc`.** No balance and no Max; the comparison becomes one MUSD-only line; the BTC quote, minimum, and stake still render.

Each line has its test in the owning task: amounts above balance → Task 9 (`plannerView`), reconnecting → Task 9 (the `LoadingCard` branch, browser QA step 5), failed gauge read → Task 5, invalid text → Task 9 (`plannerAmount`), `asset=btc` → Task 1 (`lpAmountField` with `connected: false`) and Task 9 (the BTC message state).

---

### Task 1: The amount field before a wallet connects

**Files:**
- Modify: `frontend/src/lib/flow/lp-entry.ts`
- Modify: `frontend/src/components/flow/TokenAmountInput.tsx`
- Test: `frontend/src/lib/flow/lp-entry.test.ts`, `frontend/src/components/flow/flow.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `lpAmountField(input: { preview: EntryPreview; mode: EntryMode; asset: EntryAsset; walletMusd: bigint; connected?: boolean }): LpAmountField`, where `LpAmountField.balance` and `.max` are `bigint | null`; `TokenAmountInput`'s `balance` prop becomes `bigint | null`.

- [ ] **Step 1: Write the failing tests**

In `frontend/src/lib/flow/lp-entry.test.ts`, add to `describe("lpAmountField")`:

```ts
it("hides the balance and Max before a wallet connects", () => {
  const musd = { btc: null, borrow: null } as unknown as EntryPreview;
  const field = lpAmountField({ preview: musd, mode: "deposit", asset: "musd", walletMusd: 0n, connected: false });
  expect(field.balance).toBeNull();
  expect(field.max).toBeNull();
  const fromBtc = lpAmountField({ preview: btcPreview(4n * E18), mode: "deposit", asset: "btc", walletMusd: 0n, connected: false });
  expect(fromBtc.balance).toBeNull();
  expect(fromBtc.max).toBeNull();
});
```

In `frontend/src/components/flow/flow.test.ts`, add to `describe("TokenAmountInput")`:

```ts
it("asks the visitor to connect instead of showing a zero balance", () => {
  const out = render({ balance: null, max: null });
  expect(out).toContain("Connect to see balance");
  expect(out).not.toContain("Balance 0");
  expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Max<\/button>/);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd frontend && npx vitest run src/lib/flow/lp-entry.test.ts src/components/flow/flow.test.ts`
Expected: FAIL — `field.balance` is `0n`/`10n * E18` and the markup contains `Balance 0`.

- [ ] **Step 3: Implement the change**

In `lp-entry.ts`: add `connected?: boolean` to the `lpAmountField` input (documented as "default true; false renders no balance"), widen `LpAmountField.balance` to `bigint | null`, and return `{ balance: null, max: null }` for both assets when `input.connected === false`, before the borrow branch.

In `TokenAmountInput.tsx`: widen `balance` to `bigint | null` and render the balance slot as `balance === null ? "Connect to see balance" : \`${balanceLabel} ${formatToken(balance, 18, FLOW_TOKEN_DIGITS[token])}\``.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd frontend && npx vitest run src/lib/flow/lp-entry.test.ts src/components/flow/flow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/flow/lp-entry.ts frontend/src/lib/flow/lp-entry.test.ts frontend/src/components/flow/TokenAmountInput.tsx frontend/src/components/flow/flow.test.ts
git commit -m "feat(frontend): no balance or Max before the planner connects"
```

### Task 2: Borrow & Deploy before a wallet connects

**Files:**
- Modify: `frontend/src/components/lp/ModeToggle.tsx`
- Test: `frontend/src/components/lp/mode-toggle.test.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ModeToggle` gains `connected?: boolean` (default `true`); unconnected disables Borrow & Deploy with the note `Connect a wallet to borrow against your Trove.`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/lp/mode-toggle.test.ts`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModeToggle } from "./ModeToggle";

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(ModeToggle, { walletKind: "eoa", hasTrove: true, mode: "deposit", onChange: () => undefined, ...props }));

describe("ModeToggle", () => {
  it("asks for a wallet before borrowing, even with a Trove", () => {
    const out = render({ connected: false });
    expect(out).toContain("Connect a wallet to borrow against your Trove.");
    expect(out).toMatch(/aria-disabled="true"[^>]*>\s*Borrow &amp; Deploy|Borrow &amp; Deploy[\s\S]*aria-disabled="true"/);
  });

  it("keeps the connected rule", () => {
    expect(render({})).not.toContain("Connect a wallet to borrow");
    expect(render({ hasTrove: false })).toContain("needs an open Trove");
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `cd frontend && npx vitest run src/components/lp/mode-toggle.test.ts`
Expected: FAIL on the missing note (and on `aria-disabled` if `Segmented` marks disabled options another way — read `Segmented.tsx` and use the attribute it actually renders).

- [ ] **Step 3: Implement**

In `ModeToggle.tsx`, add `connected?: boolean` (default `true`). When `false`: `disabled: true` and `note: "Connect a wallet to borrow against your Trove."`, whatever `walletKind`/`hasTrove` say. Keep the connected path as it is (`borrowMode`).

- [ ] **Step 4: Run the test to see it pass**

Run: `cd frontend && npx vitest run src/components/lp/mode-toggle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/lp/ModeToggle.tsx frontend/src/components/lp/mode-toggle.test.ts
git commit -m "feat(frontend): borrow needs a connected wallet"
```

### Task 3: A non-button primary on the LP card

**Files:**
- Modify: `frontend/src/components/lp/LpEntryCard.tsx`
- Test: `frontend/src/components/lp/lp-route.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `LpEntryCard`'s `action` gains `node?: ReactNode`; when present it renders in place of the `Button`/`ButtonLink` and owns its own label and arrow.

- [ ] **Step 1: Write the failing test**

Add to `describe("LpEntryCard")` in `frontend/src/components/lp/lp-route.test.ts`:

```ts
it("renders the page's own node as the one primary", () => {
  const out = renderToStaticMarkup(
    createElement(LpEntryCard, {
      ...props,
      action: { label: "Connect to review", node: createElement("button", { className: "bg-accent w-full" }, "Connect to review") },
    }),
  );
  expect(out.match(/bg-accent(?![\w-])/g)).toHaveLength(1);
  expect(out).toContain("Connect to review");
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `cd frontend && npx vitest run src/components/lp/lp-route.test.ts`
Expected: FAIL — two `bg-accent` matches (`Button` primary plus the node) and the node's label is absent.

- [ ] **Step 3: Implement**

In `LpEntryCard.tsx`, add `node?: ReactNode` to `action` and render `action.node` first in the action slot, before the existing disabled/link/button branches.

- [ ] **Step 4: Run the test to see it pass**

Run: `cd frontend && npx vitest run src/components/lp/lp-route.test.ts`
Expected: PASS, every existing case still green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/lp/LpEntryCard.tsx frontend/src/components/lp/lp-route.test.ts
git commit -m "feat(frontend): the LP card can host the connect button"
```

### Task 4: A flow column with an aside

**Files:**
- Modify: `frontend/src/components/flow/FlowColumn.tsx`
- Test: `frontend/src/components/flow/card.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `FlowColumn({ header, aside, children })`; without `aside` the rendered classes are byte-for-byte today's.

- [ ] **Step 1: Write the failing test**

Add to `describe("FlowColumn")` in `frontend/src/components/flow/card.test.ts`:

```ts
it("adds a 340 px aside beside the 520 px flow from lg", () => {
  const out = renderToStaticMarkup(
    createElement(FlowColumn, { header: createElement("h1", null, "T"), aside: createElement("p", { id: "aside" }, "side") }, "c"),
  );
  expect(out).toContain("max-w-[876px]");
  expect(out).toContain("lg:grid-cols-[520px_340px]");
  expect(out).toContain('id="aside"');
  // The aside follows the flow's children in source order, so a narrow screen stacks it under them.
  expect(out.indexOf('id="aside"')).toBeGreaterThan(out.indexOf(">c<"));
});

it("keeps today's centred column without an aside", () => {
  const out = renderToStaticMarkup(createElement(FlowColumn, { header: createElement("h1", null, "T") }, "c"));
  expect(out).toContain("max-w-[520px]");
  expect(out).not.toContain("876");
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `cd frontend && npx vitest run src/components/flow/card.test.ts`
Expected: FAIL on `max-w-[876px]`.

- [ ] **Step 3: Implement**

`FlowColumn` renders two shapes: no aside → today's `<div className="mx-auto w-full max-w-[520px] space-y-6">{header}<Settle index={0} className="space-y-4">{children}</Settle></div>`; with aside → an outer `mx-auto w-full max-w-[520px] space-y-6 lg:grid lg:max-w-[876px] lg:grid-cols-[520px_340px] lg:items-start lg:gap-4 lg:space-y-0` holding `<div className="space-y-6 lg:col-start-1">` (header + the same `Settle`) and `<Settle index={1} className="space-y-4 lg:col-start-2">{aside}</Settle>`.

- [ ] **Step 4: Run the test to see it pass**

Run: `cd frontend && npx vitest run src/components/flow/card.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/flow/FlowColumn.tsx frontend/src/components/flow/card.test.ts
git commit -m "feat(frontend): the flow column can carry an aside"
```

### Task 5: The comparison's rows

**Files:**
- Create: `frontend/src/lib/flow/planner-comparison.ts`
- Test: `frontend/src/lib/flow/planner-comparison.test.ts`

**Interfaces:**
- Consumes: `formatBps`, `formatPercent`, `formatToken` from `@/lib/format`; `StakeAvailability` from `@/lib/gauge/availability`; `defaultCompareAmount` from `@/lib/compare/default-amount`.
- Produces: `PlannerCompareRow`, `PlannerCompare`, `PLANNER_COMPARE_NOTE`, `plannerComparisonRows(input: { stake: { on: boolean; availability: StakeAvailability }; apr: bigint | null; weekly: bigint | null; poolFeeBps: bigint }): PlannerCompare`, and `plannerAmount(input: { text: string; musdIn: bigint | null; cap: bigint }): PlannerAmount` with `PlannerAmount = { kind: "rows"; amountMusd: bigint; amountText: string; example: boolean } | { kind: "message"; message: string }`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/flow/planner-comparison.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PLANNER_COMPARE_NOTE, plannerAmount, plannerComparisonRows } from "./planner-comparison";

const E18 = 10n ** 18n;
const base = { stake: { on: true, availability: "open" as const }, apr: 41n * 10n ** 16n, weekly: 3n * E18, poolFeeBps: 30n };
const lp = (input: Parameters<typeof plannerComparisonRows>[0]) =>
  plannerComparisonRows(input).lp.map((row) => `${row.label} ${row.value}`).join(" | ");

describe("plannerComparisonRows", () => {
  it("names this week's rate on the LP side only while the week pays", () => {
    expect(lp(base)).toContain("this week's rate");
    expect(lp(base)).toContain("41% APR");
    expect(lp({ ...base, apr: null })).toContain("3 MEZO a week");
    expect(lp({ ...base, stake: { on: true, availability: "between-weeks" } })).toContain("New week's rate not set yet");
    expect(lp({ ...base, stake: { ...base.stake, on: false } })).toContain("Pool fee 0.3%");
    expect(lp({ ...base, stake: { on: false, availability: "unavailable" } })).toContain("Pool fee 0.3%");
  });

  it("says what each route gives and holds", () => {
    const { lp: lpRows, sp } = plannerComparisonRows(base);
    expect(lpRows.map((row) => row.value)).toEqual(["Swap fees + MEZO", "≈ 41% APR", "MUSD/BTC LP"]);
    expect(lpRows[2].sub).toContain("About half your MUSD becomes BTC");
    expect(sp.map((row) => `${row.label} ${row.value}`)).toEqual([
      "You get BTC from liquidations",
      "This week Variable · paid in bursts",
      "Held MUSD until a liquidation",
    ]);
  });

  it("never annualises or percentages the Stability Pool", () => {
    const { sp } = plannerComparisonRows({ ...base, stake: { on: false, availability: "unavailable" } });
    expect(sp.some((row) => `${row.label} ${row.value} ${row.sub ?? ""}`.includes("%"))).toBe(false);
    expect(sp.some((row) => /apr|earn|annuali[sz]ed rate/i.test(`${row.value} ${row.sub ?? ""}`))).toBe(false);
    expect(PLANNER_COMPARE_NOTE).toBe("No annualised rate. Withdrawals pause while any Trove is below MCR.");
  });

  it("says Swap fees without a rate when staking is off", () => {
    expect(plannerComparisonRows({ ...base, stake: { on: false, availability: "unavailable" } }).lp[0].value).toBe("Swap fees");
  });
});

describe("plannerAmount", () => {
  it("uses the typed amount", () => {
    expect(plannerAmount({ text: "250.5", musdIn: 2505n * 10n ** 17n, cap: 1_000n * E18 })).toEqual({
      kind: "rows",
      amountMusd: 2505n * 10n ** 17n,
      amountText: "250.5",
      example: false,
    });
  });

  it("falls back to the 1,000 MUSD example on an empty field", () => {
    expect(plannerAmount({ text: "", musdIn: null, cap: 1_000n * E18 })).toEqual({
      kind: "rows",
      amountMusd: 1_000n * E18,
      amountText: "1000",
      example: true,
    });
  });

  it("asks for a valid amount otherwise", () => {
    for (const text of ["abc", ".", "0"]) {
      expect(plannerAmount({ text, musdIn: text === "0" ? 0n : null, cap: 1_000n * E18 })).toEqual({
        kind: "message",
        message: "Enter a valid amount to compare.",
      });
    }
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `cd frontend && npx vitest run src/lib/flow/planner-comparison.test.ts`
Expected: FAIL — cannot resolve `./planner-comparison`.

- [ ] **Step 3: Implement**

`plannerComparisonRows` returns fixed-shape rows built with `formatPercent`, `formatToken`, `formatBps` — no new maths. LP rows: `You get` = `Swap fees + MEZO` when `stake.on && stake.availability === "open"`, else `Swap fees`; `This week` = the APR, else the MEZO per week (when `> 0n`), else `New week's rate not set yet` for `between-weeks`, else `Pool fee ${formatBps(poolFeeBps)}`; `Held` = `MUSD/BTC LP` with the sub-line. SP rows are the three constants above. `plannerAmount`: `musdIn !== null && musdIn > 0n` → rows with `amountText: text.trim()`; empty `text` → rows from `defaultCompareAmount(0n, cap)`; otherwise the message.

- [ ] **Step 4: Run the test to see it pass**

Run: `cd frontend && npx vitest run src/lib/flow/planner-comparison.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/flow/planner-comparison.ts frontend/src/lib/flow/planner-comparison.test.ts
git commit -m "feat(frontend): the planner's two routes as rows"
```

### Task 6: The comparison card

**Files:**
- Create: `frontend/src/components/lp/PlannerComparison.tsx`
- Test: `frontend/src/components/lp/planner-comparison.test.ts`

**Interfaces:**
- Consumes: `PlannerCompare`, `PLANNER_COMPARE_NOTE` from Task 5; `Card`, `Badge`, `ButtonLink`, `Term`.
- Produces: `PlannerComparison({ amountMusd, example, state, spHref })` where `state: { kind: "rows"; rows: PlannerCompare } | { kind: "message"; message: string }` and `spHref: string | null`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/lp/planner-comparison.test.ts`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { plannerComparisonRows } from "@/lib/flow/planner-comparison";
import { PlannerComparison } from "./PlannerComparison";

const rows = plannerComparisonRows({ stake: { on: true, availability: "open" }, apr: 41n * 10n ** 16n, weekly: 3n * 10n ** 18n, poolFeeBps: 30n });
const render = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(PlannerComparison, {
      amountMusd: 1_000n * 10n ** 18n,
      example: false,
      state: { kind: "rows", rows },
      spHref: "/route/stability-pool/?amount=1000",
      ...props,
    }),
  );

describe("PlannerComparison", () => {
  it("titles the card, shows the amount, and puts the term outside the link", () => {
    const out = render();
    expect(out).toContain("Compare with the");
    expect(out).toContain("Stability Pool");
    expect(out).toContain("1,000 MUSD");
    expect(out).toContain("No annualised rate");
    // One secondary action, no accent fill: the page owns the only primary.
    expect(out.match(/bg-accent(?![\w-])/g) ?? []).toHaveLength(0);
    expect(out).toContain('href="/route/stability-pool/?amount=1000"');
  });

  it("labels the example amount", () => {
    expect(render({ example: true })).toContain("Example amount");
  });

  it("drops the link in the message state", () => {
    const out = render({ state: { kind: "message", message: "Enter a valid amount to compare." }, spHref: null });
    expect(out).toContain("Enter a valid amount to compare.");
    expect(out).not.toContain("/route/stability-pool/");
    expect(out).not.toContain("You get");
  });

  it("never shows a percentage for the Stability Pool", () => {
    const out = render();
    const sp = out.slice(out.lastIndexOf("Stability Pool", out.indexOf("You get BTC from liquidations")));
    expect(sp).toContain("Variable · paid in bursts");
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `cd frontend && npx vitest run src/components/lp/planner-comparison.test.ts`
Expected: FAIL — cannot resolve `./PlannerComparison`.

- [ ] **Step 3: Implement**

A `Card` whose title is `Compare with the <Term id="stabilityPool">Stability Pool</Term>`, aside a right-aligned `Badge` with `formatToken(amountMusd, 18, 2)` MUSD plus the `Example amount` caption when `example`. Rows state → two `<section>`s, each an `<h3 className="flex items-center gap-2 text-sm font-semibold">` with a dot (`h-2 w-2 rounded-full bg-accent` / `bg-sp`, `aria-hidden`) and a `<dl className="mt-2 space-y-2 text-sm">` of label/value rows (`dt` muted, `dd` right-aligned, `sub` as a `block text-xs text-muted`). Message state → one `text-sm text-muted` paragraph. Footer: `PLANNER_COMPARE_NOTE` in `text-xs text-muted`. `spHref !== null` → `ButtonLink href={spHref} variant="secondary" size="md" className="mt-4 w-full"` reading `Deposit to Stability Pool instead`.

- [ ] **Step 4: Run the test to see it pass**

Run: `cd frontend && npx vitest run src/components/lp/planner-comparison.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/lp/PlannerComparison.tsx frontend/src/components/lp/planner-comparison.test.ts
git commit -m "feat(frontend): compare the planner with the Stability Pool"
```

### Task 7: Before you sign

**Files:**
- Create: `frontend/src/components/lp/BeforeYouSign.tsx`
- Test: `frontend/src/components/lp/before-you-sign.test.ts`

**Interfaces:**
- Consumes: `NetworkConfig`, `explorerAddressUrl`, `shortAddress`, `formatBps`, `formatToken`, `REPOSITORY`.
- Produces: `BeforeYouSign({ network, feeBps, capMusd, blockNumber })`; renders nothing when `network.executor` is null.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/lp/before-you-sign.test.ts`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { REPOSITORY } from "@/lib/config/links";
import { BeforeYouSign } from "./BeforeYouSign";

const out = renderToStaticMarkup(
  createElement(BeforeYouSign, {
    network: networks.testnet,
    feeBps: 10n,
    capMusd: 1_000_000n * 10n ** 18n,
    blockNumber: 16_700_000n,
  }),
);

describe("BeforeYouSign", () => {
  it("names the executor, its fee, the cap, and the block", () => {
    expect(out).toContain("Before you sign");
    expect(out).toContain("0x1281…6288");
    expect(out).toContain("https://explorer.test.mezo.org/address/0x1281cC769c136F9F4f291B390c8992a3Cd556288");
    expect(out).toContain("0.1%");
    expect(out).toContain("1,000,000 MUSD");
    expect(out).toContain("16,700,000");
  });

  it("says the software is unaudited and links the source", () => {
    expect(out).toContain("Unaudited software");
    expect(out).toContain(REPOSITORY);
  });

  it("shows nothing without an executor", () => {
    expect(
      renderToStaticMarkup(createElement(BeforeYouSign, { network: { ...networks.testnet, executor: null }, feeBps: 10n, capMusd: 1n, blockNumber: 1n })),
    ).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `cd frontend && npx vitest run src/components/lp/before-you-sign.test.ts`
Expected: FAIL — cannot resolve `./BeforeYouSign`.

- [ ] **Step 3: Implement**

A `Card title="Before you sign"` holding a `<dl className="mt-3 space-y-2 text-sm">`: `Executor` (the short address as an accent link to `explorerAddressUrl`, `target="_blank" rel="noreferrer"`), `MezoRoute fee` (`formatBps(feeBps)`), `Entry cap` (`${formatToken(capMusd, 18, 0)} MUSD`), `Audit` (`Unaudited software`, same accent link style, to `REPOSITORY`), `Reads` (`Block ${formatToken(blockNumber, 0, 0)}`).

- [ ] **Step 4: Run the test to see it pass**

Run: `cd frontend && npx vitest run src/components/lp/before-you-sign.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/lp/BeforeYouSign.tsx frontend/src/components/lp/before-you-sign.test.ts
git commit -m "feat(frontend): say what signing means before the wallet connects"
```

### Task 8: The snapshot with no account

**Files:**
- Modify: `frontend/src/lib/routes/musd-btc-lp/useLpRouteSnapshot.ts`
- Test: `frontend/src/lib/routes/musd-btc-lp/snapshot.test.ts` (create)

**Interfaces:**
- Consumes: `lpRouteContracts(network, executor, account)` from `./snapshot`.
- Produces: `useLpRouteSnapshot(account: Address | undefined, executor: Address)`; `gasBalance` is `0n` while unconnected, and the gas-balance query is disabled.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/routes/musd-btc-lp/snapshot.test.ts`:

```ts
import { zeroAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { networks } from "@/lib/config/networks";
import { lpRouteContracts } from "./snapshot";

const testnet = networks.testnet;
const executor = testnet.executor!.address;

describe("lpRouteContracts with the zero address", () => {
  const calls = lpRouteContracts(testnet, executor, zeroAddress) as readonly { functionName: string; args?: readonly unknown[]; chainId: number; address: Address }[];

  it("names the zero address in every account-scoped call", () => {
    for (const name of ["allowance", "nonces", "getNonce"]) {
      const found = calls.filter((call) => call.functionName === name);
      expect(found.length, name).toBeGreaterThan(0);
      for (const call of found) expect(call.args?.[0], name).toBe(zeroAddress);
    }
  });

  it("reads the selected network and the pinned executor", () => {
    expect(new Set(calls.map((call) => call.chainId))).toEqual(new Set([testnet.chainId]));
    expect(calls.some((call) => call.address === executor)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `cd frontend && npx vitest run src/lib/routes/musd-btc-lp/snapshot.test.ts`
Expected: FAIL only for the reason under test — the existing builder already spreads the account into those calls, so the first case passes; keep it as the regression pin. If both pass, proceed: this task's failing proof is the hook change below, and the test guards it.

- [ ] **Step 3: Implement**

`useLpRouteSnapshot(account: Address | undefined, executor: Address)`:
- `lpRouteContracts(network, executor, account ?? zeroAddress)`.
- `useBalance({ address: account, chainId: network.chainId, query: { enabled: account !== undefined, refetchInterval: QUOTE_REFRESH_MS } })`.
- data ready when `reads.data && (account === undefined || gas.data)`; `toData(reads.data, account === undefined ? 0n : gas.data!.value, gasPrice.data, reads.dataUpdatedAt)`.
- `error: reads.error ?? (account === undefined ? null : gas.error)`.
- `refresh` keeps its contract: when unconnected, use `0n` for the balance and do not require `freshGas.data`.

- [ ] **Step 4: Run the test to see it pass**

Run: `cd frontend && npx vitest run src/lib/routes/musd-btc-lp/snapshot.test.ts && npx tsc --noEmit`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/routes/musd-btc-lp/useLpRouteSnapshot.ts frontend/src/lib/routes/musd-btc-lp/snapshot.test.ts
git commit -m "feat(frontend): read the planner snapshot with the zero address"
```

### Task 9: The planner page

**Files:**
- Create: `frontend/src/lib/flow/planner.ts`
- Modify: `frontend/src/components/lp/LpRoutePage.tsx`
- Test: `frontend/src/lib/flow/planner.test.ts` (create)

**Interfaces:**
- Consumes: Tasks 1–8.
- Produces: `plannerView(input: { connected: boolean; block: EntryBlock | null; walletChainId: number | undefined; chainId: number }): { block: EntryBlock | null; wrongNetwork: boolean }`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/flow/planner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { EntryBlock } from "@/lib/routes/musd-btc-lp/gate";
import { plannerView } from "./planner";

const block: EntryBlock = { reason: "insufficient-balance", outcome: null };

describe("plannerView", () => {
  it("hides the wallet's gate and network warning before a wallet connects", () => {
    expect(plannerView({ connected: false, block, walletChainId: 31612, chainId: 31611 })).toEqual({ block: null, wrongNetwork: false });
  });

  it("passes the gate and the network warning through once connected", () => {
    expect(plannerView({ connected: true, block, walletChainId: 31612, chainId: 31611 })).toEqual({ block, wrongNetwork: true });
    expect(plannerView({ connected: true, block: null, walletChainId: 31611, chainId: 31611 })).toEqual({ block: null, wrongNetwork: false });
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `cd frontend && npx vitest run src/lib/flow/planner.test.ts`
Expected: FAIL — cannot resolve `./planner`.

- [ ] **Step 3: Implement `plannerView`**

Return `block` unchanged and `wrongNetwork: walletChainId !== chainId` when `connected`; `{ block: null, wrongNetwork: false }` otherwise.

- [ ] **Step 4: Run the test to see it pass**

Run: `cd frontend && npx vitest run src/lib/flow/planner.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewire `LpRoutePage`**

- Default export: `const { address, status } = useAccount();` → `status === "reconnecting"` renders `<LoadingCard label="Connecting wallet" lines={2} />`; otherwise `network.executor` check (`NoExecutorCard`), then `<LpRouteForm account={address} executor={network.executor.address} />`.
- `LpRouteForm({ account, executor })` with `account: Address | undefined`; `const connected = account !== undefined;`
- `const displayMode = connected ? intent.mode : "deposit"` and pass `{ ...intent, mode: displayMode }` to `entryPreview` (with `walletKind: walletKind ?? "unknown"`). The URL keeps the user's `mode`.
- `const view = plannerView({ connected, block: preview.block, walletChainId: chainId, chainId: network.chainId });` — every recovery and `BlockNotice` reads `view.block`, so an unconnected planner shows no gate.
- `WrongNetworkAlert` renders on `view.wrongNetwork` only.
- `ModeToggle` gets `connected`; `lpAmountField` gets `connected`; `note` (gas reserve) is `undefined` while unconnected.
- Primary: unconnected → `{ label: "Connect to review", node: <ConnectCta label="Connect to review" variant="primary" className="w-full" arrow /> }`; connected → `splitPrimary`'s result or the Review link as today.
- Aside: `displayMode === "deposit"` → `PlannerComparison` with `comparison` from `plannerAmount({ text: intent.amount, musdIn: intent.musdIn, cap: network.entryCap })` (or the BTC message when `intent.asset === "btc"`), `spHref` = `comparison.kind === "rows" ? `/route/stability-pool/${spDepositQuery(comparison.amountText)}` : null`; always `BeforeYouSign` with `feeBps={data.snapshot.executorFeeBps}`, `capMusd={data.snapshot.maxMusdIn}`, `blockNumber={data.snapshot.blockNumber}`.
- The comparison is not rendered in Borrow & Deploy mode.

- [ ] **Step 6: Run the page's neighbours and typecheck**

Run: `cd frontend && npx vitest run src/lib/flow src/components/lp && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/flow/planner.ts frontend/src/lib/flow/planner.test.ts frontend/src/components/lp/LpRoutePage.tsx
git commit -m "feat(frontend): quote the LP route before the wallet connects"
```

### Task 10: Browser QA, the full gate, and the handover

**Files:**
- Modify: `docs/STATUS.md`, `AGENTS.md`

- [ ] **Step 1: Build and run the full suite**

Run: `cd frontend && npm test && npm run build`
Expected: every Vitest test passes; the build prints a First Load JS figure. Record both numbers.

- [ ] **Step 2: Serve and drive the export**

`cd frontend && python3 -m http.server 4321 --bind 127.0.0.1` from `frontend/out`, then drive it with the keyless mock EIP-1193 wallet (STATUS → QA accounts): steps 1–9 of the spec's Browser QA matrix at 360/768/1440 px in light and dark. Record the block the mainnet planner read at (spec Risks).

- [ ] **Step 3: Update the handover docs**

`docs/STATUS.md`: add the U13 row (spec + plan paths, what changed, test and build counts, QA result) and one session-log line. `AGENTS.md`: add a U13 sentence to the Frontend section: the planner is wallet-free, the zero-address snapshot, the aside, and that `FlowColumn`'s `aside` is opt-in.

- [ ] **Step 4: Commit**

```bash
git add docs/STATUS.md AGENTS.md
git commit -m "docs: record the U13 read-only planner"
```
