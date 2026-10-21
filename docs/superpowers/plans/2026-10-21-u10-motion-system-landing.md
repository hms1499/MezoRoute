# U10 Motion System and Brand Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One easing curve and three durations across the app, a Morpho-style button (label roll, arrow circle, press), one pending pattern, one loading pattern, and a brand hero with Morpho-rhythm sections on the landing.

**Architecture:** Motion values live once in `src/lib/ui/motion.ts`; the Tailwind plugin writes them as CSS variables next to the palettes and exposes `ease-smooth`/`duration-fast|base|slow` utilities; a source guard (like `typography.test.ts`) rejects any other easing or numeric duration. `Button` gains the roll, an opt-in `arrow` circle and a `pending` presentation; `Skeleton` breathes and a `Settle` wrapper animates content on mount. The landing's hero is rebuilt around a pure-geometry route motif; the simulator moves to its own section.

**Tech Stack:** Next.js 14.2.35 static export, React 18.3.1, Tailwind 3.4.19, Vitest 5 (node environment, `*.test.ts` only), lucide-react 1.49.0, Playwright MCP for QA.

**Spec:** `docs/superpowers/specs/2026-10-21-u10-motion-system-landing-design.md` (read it; this plan argues from it). Mockups the user picked: `.superpowers/brainstorm/21235-1792549506/content/{buttons,loading,hero-v2}.html` (git-ignored; open in a browser for reference, option B everywhere).

## Global Constraints

- Branch `feat/u10-motion-landing` (exists, spec committed). Commit prefixes `feat(frontend):`, `fix(frontend):`, `test(frontend):`, `docs:`; end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Curves: smooth `cubic-bezier(0.36, 0.2, 0.07, 1)`, swift `cubic-bezier(0.2, 0, 0, 1)` (button arrow only). Durations: fast 200 ms, base 400 ms, slow 600 ms.
- Every animation and every non-colour transition runs only under `prefers-reduced-motion: no-preference` (`motion-safe:` or the existing media block); the global reduce rule at the end of `globals.css` stays.
- Tokens only: no hex in components (`palette-guard.test.ts`), sizes/weights from the type scale (`typography.test.ts`), SVG colours through `themeColor`, decorative icons `aria-hidden`.
- 360 px: no horizontal page scroll; header Connect/account buttons no wider than on `main`.
- No new dependencies. `npm test && npm run build` pass after every task; First Load JS of `/` ≤ 97 kB (92 kB on `main`).
- No change to flow hooks, `confirmCall`, receipt tracking, providers, palettes, or type sizes.
- Copy fixed by the spec: hero H1 "Route MUSD." / "Know the BTC risk."; pending labels "Check your wallet…", "Confirming…", "Done" (today's `StepList` strings); hero caption `STRIP_CAPTION` ("Live from Mezo mainnet. Past results, not a forecast.").
- Run commands from `frontend/`. Don't run `next build` while `next dev` runs. After `npm run build`, serve `out/` for QA (e.g. `npx serve out -l 4173`).

## Review Focus

1. **Touch devices** (`hover: none`): after a tap, a button must not stay in its rolled state. Pinned by the CSS contract test in Task 2 (roll rules only inside `@media (hover: hover)`), checked in Task 7 with touch emulation.
2. **Refetch and keystrokes**: values must not replay the settle when the 15 s snapshot refetches or the simulator amount changes. Pinned in Task 4 (`Settle` animates on mount only; Playwright waits through one refetch on `/route/lp/`).
3. **Screen readers**: a button's accessible name is its label once, even while pending (status text `aria-hidden`), and the stepper announces each status once. Pinned by markup tests in Tasks 2–3 and the accessibility snapshot in Task 7.
4. **Reduced motion**: every element shows its final state and `document.getAnimations()` is empty after load, including the motif's dots and the skeleton. Pinned in Task 7.
5. **Flash of the "Done" pill**: a step that finishes while the user navigates away (unmount within 1.2 s) must not set state after unmount. Pinned in Task 3 (timer cleared on unmount, checked with React's dev warning absent in QA console).

---

### Task 1: Motion tokens, Tailwind utilities, and the motion guard

**Files:**
- Modify: `src/lib/ui/motion.ts`, `src/lib/ui/motion.test.ts`
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css` (`--landing-motion-*`, `.landing-*` timing functions)
- Create: `src/lib/ui/motion-guard.test.ts`
- Modify (to satisfy the guard): `src/components/Header.tsx:36`, `src/components/ui/RiskList.tsx:16`, `src/components/chart/BtcMoveChart.tsx:131`, `src/components/lp/ConfirmSummary.tsx:99`, `src/components/dashboard/RouteComparison.tsx:188`, `src/components/ui/Button.tsx:10`, `src/app/client-providers.tsx:18`, `src/components/ErrorToast.tsx:111` (via the `toast-in` animation definition)

**Interfaces:**
- Produces (in `motion.ts`):
  - `EASE: { smooth: readonly [0.36, 0.2, 0.07, 1]; swift: readonly [0.2, 0, 0, 1] }`
  - `MOTION_MS: { fast: 200; base: 400; slow: 600; tick: 1000; doneFlash: 1200; settleStagger: 60 }`
  - `cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number`
  - `easeSmooth: (t: number) => number` (= `cubicBezier(...EASE.smooth)`), used by `countUpAt` instead of `easeOutCubic` (remove `easeOutCubic` if nothing else uses it)
  - `motionVariables(): Record<string, string>` → `{ "--ease-smooth": "cubic-bezier(0.36, 0.2, 0.07, 1)", "--ease-swift": "cubic-bezier(0.2, 0, 0, 1)", "--motion-fast": "200ms", "--motion-base": "400ms", "--motion-slow": "600ms" }`
  - `MOTION_KEYFRAMES` and `MOTION_ANIMATIONS` objects consumed by `tailwind.config.ts`: `breathe` (opacity 1 → 0.45, `breathe 1.6s var(--ease-smooth) infinite alternate`), `toast-in` (unchanged frames, `var(--motion-fast) var(--ease-smooth)`), `dot-wave` (0 %/100 %: opacity 0.25, translateY 0; 40 %: opacity 1, translateY −3 px; `1s var(--ease-smooth) infinite`), `roll-in` (from translateY(100 %) opacity 0; `var(--motion-base) var(--ease-smooth) both`), `settle` (from translateY(8 px) opacity 0; `var(--motion-slow) var(--ease-smooth) both`). `shimmer` is removed.
  - `LANDING_MOTION_MS` keeps only the long one-offs (`chartDraw`, `timeline`, `livePulse`, `valueFlash`, `simulatorCount`, `liveCount`); `control`/`card`/`reveal` callers switch to `MOTION_MS.fast`/`fast`/`slow`.
- Tailwind utilities produced: `ease-smooth`, `ease-swift`, `duration-fast`, `duration-base`, `duration-slow`, `duration-tick`; `DEFAULT` timing function `var(--ease-smooth)` and `DEFAULT` duration `var(--motion-fast)` (so a bare `transition-colors` is on-token); `animate-breathe`, `animate-toast-in`, `animate-dot-wave`, `animate-roll-in`, `animate-settle`.

- [ ] **Step 1: Write the failing tests** in `motion.test.ts`:

```ts
describe("motion tokens (U10)", () => {
  it("evaluates the smooth curve", () => {
    expect(easeSmooth(0)).toBe(0);
    expect(easeSmooth(1)).toBe(1);
    expect(easeSmooth(0.25)).toBeCloseTo(0.4716, 3);
    expect(easeSmooth(0.5)).toBeCloseTo(0.8704, 3);
    for (let i = 1; i <= 100; i++) expect(easeSmooth(i / 100)).toBeGreaterThanOrEqual(easeSmooth((i - 1) / 100));
  });
  it("clamps outside 0–1", () => {
    expect(easeSmooth(-1)).toBe(0);
    expect(easeSmooth(2)).toBe(1);
  });
  it("writes the CSS variables from the same values", () => {
    expect(motionVariables()).toEqual({
      "--ease-smooth": "cubic-bezier(0.36, 0.2, 0.07, 1)",
      "--ease-swift": "cubic-bezier(0.2, 0, 0, 1)",
      "--motion-fast": "200ms",
      "--motion-base": "400ms",
      "--motion-slow": "600ms",
    });
  });
  it("counts up along the smooth curve", () => {
    expect(countUpAt(0n, 1000n, 300, 600)).toBe(870n); // easeSmooth(0.5) ≈ 0.8704
  });
});
```

Adjust the existing `countUpAt`/`easeOutCubic` tests to the new curve (exact ends stay exact).

- [ ] **Step 2: Write the failing guard** `motion-guard.test.ts`, modelled on `typography.test.ts` (same `sourceFiles()` walk over `src/`, `.ts/.tsx/.css`, tests excluded). Source of truth exempt: `lib/ui/motion.ts`. Rules (name → pattern):
  - `"easing class"` → `/\bease-(in|out|in-out)\b/` (Tailwind classes; `ease-linear` allowed)
  - `"numeric duration"` → `/\bduration-\d+\b/` and `/\bduration-\[/`
  - `"raw curve"` → `/cubic-bezier\(/`
  - `"css easing keyword"` (CSS files only) → `/(transition|animation)[^;]*\b(ease|ease-in|ease-out|ease-in-out)\b(?!-)/`
  - `"removed animation"` → `/\banimate-(shimmer|pulse)\b/`
  Plus a "catches each rule" test with one offending line per rule and a "source is clean" test (`expect(offenders).toEqual([])` listing `file:line rule`).

- [ ] **Step 3: Run** `npx vitest run src/lib/ui/motion.test.ts src/lib/ui/motion-guard.test.ts` — expected: FAIL (missing exports; the guard lists the current offenders above).

- [ ] **Step 4: Implement** the `motion.ts` exports (the bezier evaluator: solve x(t) = input by bisection or Newton, return y(t); clamp input to [0, 1]); in `tailwind.config.ts` add `motionVariables()` to the plugin's `addBase` on `:root` and the theme extensions listed above; in `globals.css` point `--landing-motion-control/card` at `var(--motion-fast)`, `--landing-motion-reveal` at `var(--motion-slow)`, and replace every `ease`, `ease-out`, `cubic-bezier(0.2, 0.7, 0.2, 1)` in `.landing-*` rules with `var(--ease-smooth)`. Fix the offenders: drop `duration-150 ease-out` (the defaults now apply), `duration-200` → `duration-fast`, `duration-1000` → `duration-tick` (keep `ease-linear`: it is a countdown bar), `animate-pulse` → `animate-breathe`.

- [ ] **Step 5: Run** `npm test` — expected: all pass (≈905 + new).

- [ ] **Step 6: Run** `npm run build` — expected: success, First Load JS of `/` ≤ 97 kB. Grep the built CSS: `grep -o "cubic-bezier(0.36, 0.2, 0.07, 1)" out/_next/static/css/*.css | head -1` prints a match.

- [ ] **Step 7: Commit** `feat(frontend): one motion curve and three durations (U10)`.

---

### Task 2: Button label roll, arrow circle, and press

**Files:**
- Modify: `src/components/ui/Button.tsx`, `src/components/ui/Button.test.ts`
- Modify: `src/app/globals.css` (button roll/arrow rules in `@layer components`)
- Modify: `src/lib/ui/tokens.ts` (`textPairs`: arrow-circle pair)
- Modify (add `arrow`): `src/components/home/ConnectCta.tsx` (pass-through prop `arrow?: boolean`, default false), `src/components/landing/FinalCta.tsx` (ConnectCta `arrow`), `src/components/lp/LpRoutePage.tsx:91`, `src/components/stability-pool/SpRoutePage.tsx:66`, `src/components/dashboard/ReadinessCard.tsx:59-60`, `src/components/dashboard/RouteComparison.tsx:170,221`, `src/components/positions/PositionsPage.tsx:81-82`, `src/components/positions/LpPositionCard.tsx:46`, `src/components/stability-pool/SpPositionCard.tsx:51`, `src/components/receipt/ReceiptPage.tsx:183`

**Interfaces:**
- Consumes: Task 1 utilities (`duration-base`, `ease-smooth`, `ease-swift`, `duration-fast`).
- Produces: `Button`/`ButtonLink` prop `arrow?: boolean`. Markup contract (tests and later tasks rely on it):
  - Label: `<span class="btn-roll"><span class="btn-label">{children}</span><span class="btn-label" aria-hidden="true">{children}</span></span>` for every size except `icon` (which renders children once).
  - Arrow: `<span class="btn-circle" aria-hidden="true">` containing two lucide `ArrowRight` icons with classes `btn-arrow`; with `arrow`, padding is `pl-5 pr-1.5` (md) / `pl-3.5 pr-1` (sm, circle 28 px).
  - External `ButtonLink` keeps its `ExternalLink` glyph after the roll and never renders the circle.
- CSS contract in `globals.css`: hover/focus-visible roll and arrow swap only inside `@media (hover: hover) and (prefers-reduced-motion: no-preference)` (focus-visible also allowed under `(hover: none)`); label roll uses `duration-base`/`--ease-smooth`; arrow uses `--motion-slow` (600 ms) and `--ease-swift`, circle `scale(1.06)`; press `motion-safe:active:scale-[0.97]` on `BASE`. Circle colours: primary-like variants (`primary`, `night`) circle `bg-onAccent text-accent`; outlined/ghost variants circle `bg-accent text-onAccent`.

- [ ] **Step 1: Write the failing tests** in `Button.test.ts` using `createElement` + `renderToStaticMarkup` from `react-dom/server` (node env, no JSX in `.ts`):

```ts
const html = (el: ReactElement) => renderToStaticMarkup(el);
it("renders the label twice, the copy hidden from assistive tech", () => {
  const out = html(createElement(Button, null, "Deposit to LP"));
  expect(out.match(/Deposit to LP/g)).toHaveLength(2);
  expect(out).toMatch(/<span class="btn-label" aria-hidden="true">Deposit to LP<\/span>/);
});
it("renders the arrow circle only when asked", () => {
  expect(html(createElement(Button, null, "Go"))).not.toContain("btn-circle");
  const out = html(createElement(Button, { arrow: true }, "Go"));
  expect(out.match(/btn-arrow/g)).toHaveLength(2);
  expect(out).toContain('class="btn-circle');
});
it("keeps icon buttons to one child", () => {
  expect(html(createElement(Button, { size: "icon", "aria-label": "Theme" }, "x")).match(/x/g)).toHaveLength(1);
});
it("never puts a circle on external links", () => {
  const out = html(createElement(ButtonLink, { href: "https://x", external: true, arrow: true }, "Mezo"));
  expect(out).not.toContain("btn-circle");
});
it("presses on active", () => expect(buttonClass()).toContain("motion-safe:active:scale-[0.97]"));
```

And a CSS contract test (read `src/app/globals.css` as text): every rule mentioning `.btn-roll` or `.btn-arrow` with `:hover` sits inside an `@media (hover: hover)` block.

In `contrast.test.ts` coverage: add to `textPairs` `["accent on onAccent (arrow circle on primary)", p.accent, p.onAccent]` (existing test then checks both themes).

- [ ] **Step 2: Run** `npx vitest run src/components/ui/Button.test.ts src/lib/ui/contrast.test.ts` — expected: FAIL (no `btn-label`, no `arrow` prop).

- [ ] **Step 3: Implement** in `Button.tsx` (internal `Roll` and `ArrowCircle` components shared by `Button` and `ButtonLink`), the CSS rules, the contrast pair, and the `arrow` props at the listed call sites (forward buttons only; never Header Connect/account, `icon`, presets, Cancel/back, `danger`, external, retry/refresh).

- [ ] **Step 4: Run** `npm test` — expected: PASS.

- [ ] **Step 5: Run** `npm run build`, serve `out/`, and with Playwright at 360 px and 1440 px (light and dark): measure the header Connect button's width against `main` (`git stash` not needed: build `main` into a temp copy or compare with production `https://mezoroute.vercel.app`) — equal ±1 px; `document.documentElement.scrollWidth === innerWidth` on `/`; hover a primary arrow button and screenshot mid-transition (≈200 ms) to see both labels moving.

- [ ] **Step 6: Commit** `feat(frontend): button label roll, arrow circle, press (U10)`.

---

### Task 3: Pending state on buttons, the stepper, and the receipt

**Files:**
- Create: `src/lib/ui/pending.ts`, `src/lib/ui/pending.test.ts`
- Create: `src/components/ui/DotWave.tsx`
- Modify: `src/components/ui/Button.tsx`, `src/components/ui/Button.test.ts`
- Modify: `src/lib/ui/step-visual.ts`, `src/lib/ui/step-visual.test.ts`
- Modify: `src/components/ui/StepList.tsx`
- Modify: `src/components/receipt/ReceiptPage.tsx` (`StatusIcon`)
- Modify (migrate `loading` → `pending`): `src/components/positions/FeesCard.tsx:29`, `src/components/stability-pool/SpPositionCard.tsx:52`, `src/components/stability-pool/SpWithdrawPage.tsx:96-98,131,149,176`, `src/components/home/WrongNetworkAlert.tsx:20-22`

**Interfaces:**
- Consumes: Task 2 markup (`btn-roll`, `btn-circle`), Task 1 `animate-dot-wave`, `animate-roll-in`, `MOTION_MS.doneFlash`.
- Produces:
  - `pending.ts`: `export type Pending = "wallet" | "confirming" | "done" | "busy"`; `export const PENDING_TEXT: Record<"wallet" | "confirming" | "done", string> = { wallet: "Check your wallet…", confirming: "Confirming…", done: "Done" }`; `export function pendingText(pending: Pending): string | null` (`"busy"` → `null`: keep the idle label).
  - `Button` prop `pending?: Pending | null` replaces `loading`. When set: `data-pending={pending}`, `aria-busy="true"` (except `"done"`), `aria-disabled="true"`, `onClick` not called; idle label stays in the accessibility tree but is moved out visually; the status label (`pendingText`) renders in a `<span class="btn-status" aria-hidden="true" key={text}>` with `animate-roll-in` (motion-safe), so each new status rolls in; the circle (the arrow circle, or a circle that appears for non-arrow buttons) shows `<DotWave />` for `wallet`/`confirming`/`busy` and a lucide `Check` for `done`. Full colour while pending (no `disabled:opacity-50` look).
  - `DotWave({ className }: { className?: string })`: three 4 px dots, `motion-safe:animate-dot-wave` with 0 / 150 / 300 ms delays, `aria-hidden`.
  - `step-visual.ts`: `export function newlyDone<K extends string>(prev: Step<K>[], next: Step<K>[]): K[]` (kinds whose status became `"done"` between the two arrays).

- [ ] **Step 1: Write the failing tests:**
  - `pending.test.ts`: `pendingText("wallet") === "Check your wallet…"`, `"confirming" → "Confirming…"`, `"done" → "Done"`, `"busy" → null`; `PENDING_TEXT` equals `StepList`'s current `STATUS_TEXT` strings (import both; `StepList` will import from `pending.ts` after Step 3, so assert the literal values here).
  - `step-visual.test.ts`: `newlyDone([idle approve, idle enter], [done approve, idle enter])` → `["approve"]`; unchanged arrays → `[]`; a step already done in `prev` is not reported.
  - `Button.test.ts`: with `pending: "wallet"` the markup has `aria-busy="true"`, `aria-disabled="true"`, `data-pending="wallet"`, the label "Deposit to LP" still present (accessible name), `<span class="btn-status…" aria-hidden="true">Check your wallet…</span>`, and the dot-wave markup; with `pending: "done"` it has a check icon and no `aria-busy`; with `pending: "busy"` there is no `btn-status`; a non-arrow button with `pending` renders `btn-circle`.

- [ ] **Step 2: Run** `npx vitest run src/lib/ui/pending.test.ts src/lib/ui/step-visual.test.ts src/components/ui/Button.test.ts` — expected: FAIL.

- [ ] **Step 3: Implement** `pending.ts`, `DotWave`, `newlyDone`, and the `Button` `pending` presentation (remove `loading` and the `LoaderCircle` import from `Button.tsx`).

- [ ] **Step 4: Rework `StepList`** (no unit test; QA in Task 7):
  - The active step's button stays visible while its visual is `wallet` (`pending="wallet"`) or `confirming` (`pending="confirming"`); it renders outside the `aria-live` region.
  - The `aria-live="polite"` region keeps today's `STATUS_TEXT` strings (now `PENDING_TEXT`), visually hidden (`sr-only`) whenever the button shows the same status; the "Done" text of finished steps stays visible as today.
  - A local `flash` state holds the kind returned by `newlyDone(previousSteps, steps)` (previous steps kept in a ref); that step renders a non-interactive `Button pending="done"` for `MOTION_MS.doneFlash` (1200 ms), then today's finished row. Clear the timer on unmount and when a new flash starts.
  - `StepNode` glyphs unchanged.

- [ ] **Step 5: Receipt:** `StatusIcon`'s pending branch renders a 48 px accent-ringed circle containing `DotWave`; confirmed stays `CircleCheck` (swap is the "turns into the check").

- [ ] **Step 6: Migrate callers:** `loading={x}` → `pending={x ? "wallet" : null}` in FeesCard, SpPositionCard, SpWithdrawPage; WrongNetworkAlert → `pending={isPending ? "busy" : null}`.

- [ ] **Step 7: Run** `npm test && npm run build` — expected: PASS, `/` ≤ 97 kB.

- [ ] **Step 8: Commit** `feat(frontend): one pending pattern for wallet actions (U10)`.

---

### Task 4: Breathing skeleton and settle-in

**Files:**
- Modify: `src/components/ui/Skeleton.tsx`
- Create: `src/components/ui/Settle.tsx`
- Modify: `src/app/globals.css` (`.settle` rule inside the `no-preference` block)
- Modify (wrap first-arrival content): `src/components/dashboard/Dashboard.tsx`, `src/components/dashboard/RouteComparison.tsx`, `src/components/dashboard/MainnetReferenceCard.tsx`, `src/components/positions/PositionsPage.tsx`, `src/components/positions/LpPositionCard.tsx`, `src/components/positions/ExitPage.tsx`, `src/components/stability-pool/SpPositionCard.tsx`, `src/components/stability-pool/SpRoutePage.tsx`, `src/components/stability-pool/SpConfirmPage.tsx`, `src/components/stability-pool/SpWithdrawPage.tsx`, `src/components/lp/LpRoutePage.tsx`, `src/components/lp/LpConfirmPage.tsx`, `src/components/landing/Simulator.tsx`, `src/components/home/RequireWallet.tsx` (only if it swaps a skeleton for content)
- Test: `src/lib/ui/motion-guard.test.ts` (extend), `src/components/ui/Settle.test.ts`

**Interfaces:**
- Consumes: Task 1 `animate-breathe`, `--motion-slow`, `--ease-smooth`, `MOTION_MS.settleStagger`.
- Produces: `Settle({ index = 0, as = "div", className, children }: { index?: number; as?: "div" | "span" | "li" | "dd"; className?: string; children: ReactNode })` → element with class `settle` and `style={{ "--i": index }}`. CSS: `.settle { animation: settle var(--motion-slow) var(--ease-smooth) both; animation-delay: calc(var(--i, 0) * 60ms); }` inside `@media (prefers-reduced-motion: no-preference)` only. It animates on mount, so it never replays while the element stays mounted.
- `Skeleton`: `block rounded-lg bg-line motion-safe:animate-breathe` (no gradient).

- [ ] **Step 1: Write the failing tests:** `Settle.test.ts` (renderToStaticMarkup): `Settle` with `index: 2` renders `class="settle"` and `style="--i:2"`; `as: "li"` renders an `<li>`. In `motion-guard.test.ts` add: `globals.css` has the `.settle` rule only inside a `prefers-reduced-motion: no-preference` block; `Skeleton.tsx` contains `animate-breathe` and no `bg-gradient`.

- [ ] **Step 2: Run** `npx vitest run src/components/ui/Settle.test.ts src/lib/ui/motion-guard.test.ts` — expected: FAIL.

- [ ] **Step 3: Implement** `Settle`, the CSS, the `Skeleton` change.

- [ ] **Step 4: Wrap call sites:** in each listed file, where a loading branch (`Skeleton`/`LoadingCard`) gives way to content, wrap the content's top-level blocks (cards, stat rows, table rows) in `Settle` with `index` in reading order (0, 1, 2…; cap at 8). Do not wrap content that re-mounts on every refetch or keystroke; if a component unmounts its content while refetching, leave it unwrapped and note it in the commit body.

- [ ] **Step 5: Run** `npm test && npm run build` — expected: PASS.

- [ ] **Step 6: QA (Review Focus 2):** serve `out/`, mock wallet on testnet `/route/lp/?amount=100`; record `document.getAnimations().filter(a => a.animationName === "settle").length` right after load and again after 16 s (one refetch): the second count is 0. Type a new amount in the landing simulator: no `settle` animation starts.

- [ ] **Step 7: Commit** `feat(frontend): breathing skeleton and settle-in (U10)`.

---

### Task 5: Brand hero and the route motif

**Files:**
- Create: `src/lib/landing/route-motif.ts`, `src/lib/landing/route-motif.test.ts`
- Create: `src/components/landing/RouteMotif.tsx`, `src/components/landing/HeroFigures.tsx`
- Modify: `src/components/landing/Hero.tsx` (rewrite), `src/components/landing/Landing.tsx` (remove `LiveStrip`; temporarily render `HeroChart` + `Simulator` below the hero until Task 6)
- Delete: `src/components/landing/LiveStrip.tsx`
- Modify: `src/lib/ui/tokens.ts` (`display`, `display-lg` weight `"300"`, letter-spacing `"-0.02em"`), `src/lib/ui/typography.test.ts`
- Modify: `src/app/globals.css` (`.landing-frame` grid background, `.frame-cross`, `.eyebrow`, `.motif-flow`)

**Interfaces:**
- Consumes: `liveStrip()`, `STRIP_CAPTION`, `compactMusd` from `src/lib/landing/view.ts` (unchanged; `LiveStrip` type stays), `useMainnetReference`, `ConnectCta` with `arrow`, `ButtonLink`/anchor with `buttonClass` + `arrow`, `Settle`, `Skeleton`, `themeColor`.
- Produces:
  - `routeMotif({ width, height, lanes = 6 }: { width: number; height: number; lanes?: number }): { incoming: string[]; lp: string[]; sp: string[]; node: { x: number; y: number; width: number; height: number } }` — SVG path `d` strings; `incoming.length === 2 * lanes`, `lp.length === sp.length === lanes`; every path starts at x = 0 (incoming) or the node's right edge (lanes) and ends at x = 0 / x = `width`; LP lane end points have y < node centre, SP lane ends y > node centre; node centred vertically, at ≈ 55–65 % of the width. Geometry follows `hero-v2.html` (incoming curves converge into the node; lanes fan out to the right edge).
  - `RouteMotif({ className }: { className?: string })`: `aria-hidden` SVG (`viewBox` fixed, `preserveAspectRatio="xMidYMid meet"`), hairlines at 35 % opacity, incoming lines fading in from the left via a `linearGradient` (`stop-opacity` 0 → 1), LP lanes `themeColor.accent`, SP lanes `themeColor.sp`, node pill `surface` fill + `accent` stroke with "MezoRoute" text (`CHART_FONT_PX`), lane labels "LP" / "Stability Pool"; a second copy of each path with class `motif-flow` (`stroke-dasharray: 2 90`, `animation: motif-flow 4s linear infinite`, negative staggered delays) only under `no-preference`; lines draw in once with `landing-draw` (`pathLength="1"`).
  - `HeroFigures({ live }: { live: LiveStrip })`: loading → two skeleton pairs (`role="status"`, `aria-label="Loading mainnet figures"` on the first); hidden → `null`; data → two items, label in `.eyebrow` ("MUSD/BTC pool", "Stability Pool"), value `.figure` (`formatToken(poolValue, 18, 0) + " MUSD"` with `useCountUp` from zero as today, `compactMusd(spDeposits)`), sub-line `text-xs text-muted` (`lpFees.value` + " LP fees, last 30 days · " + `lpFees.sub`, or omitted when `lpFees` is null; `${spShare} of MUSD supply`), each wrapped in `Settle`.
- Hero layout: `section.landing-frame` (grid background: 20 px cells from `rgb(var(--color-line) / 0.7)` linear-gradients; four `.frame-cross` spans at the corners, `accent` at 60 %); inside, `grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]`, min-height 520 px from `lg`; left column: H1 (`text-display sm:text-display-lg`, two `landing-rise` lines "Route MUSD." / "Know the BTC risk."), today's lead paragraph, CTAs (ConnectCta `primary` `arrow`; anchor "Compare routes" to `#simulator`, `buttonClass("secondary")` + arrow, both full width below 640 px), `HeroFigures`; right column: `RouteMotif` (below `lg` it comes after the copy at ≈ 200 px tall). Below the frame, the peek row: hairline, "Try an amount ↓" link to `#simulator`, caption `STRIP_CAPTION` (only when `live.kind === "data"`). The motif can never sit under the copy: it has its own grid cell.

- [ ] **Step 1: Write the failing tests:**
  - `route-motif.test.ts`: the counts above; every `d` starts with `M0 ` (incoming) or `M${node.x + node.width} ` (lanes); every lane ends at x = `width`; LP ends above / SP ends below the node centre; `routeMotif({ width: 600, height: 520 })` node centre y = 260.
  - `typography.test.ts`: `display` → `["40px", { lineHeight: "48px", fontWeight: "300", letterSpacing: "-0.02em" }]`, `display-lg` → `["48px", { lineHeight: "52px", fontWeight: "300", letterSpacing: "-0.02em" }]`; the weight test becomes "uses weight 300 only for the display tokens".
  - `palette-guard`/`typography` scans must pass on the new components (they run automatically).

- [ ] **Step 2: Run** `npx vitest run src/lib/landing/route-motif.test.ts src/lib/ui/typography.test.ts` — expected: FAIL.

- [ ] **Step 3: Implement** `route-motif.ts`, the token change, `RouteMotif`, `HeroFigures`, the CSS classes, the new `Hero` (props: `{ data: MainnetReferenceData | undefined; error: Error | null }`), and the temporary `Landing` wiring (amount state moves out of `Hero` into `Landing` for now; Task 6 moves it into the simulator section).

- [ ] **Step 4: Run** `npm test && npm run build` — expected: PASS, `/` ≤ 97 kB. Confirm Inter weight 300 renders (variable font): in Playwright, `getComputedStyle(h1).fontWeight === "300"` and the glyphs are visibly lighter in a screenshot.

- [ ] **Step 5: QA:** 360/768/1024/1440 px × light/dark: no horizontal scroll; motif bounding box does not intersect the H1, paragraph, CTA, or figures boxes; reduced motion → `document.getAnimations().length === 0` after 2 s; figures show skeletons, then values; with the mainnet RPC blocked (`page.route("**/rpc-internal.mezo.org/**", r => r.abort())`) the figures and caption are absent and the page still renders.

- [ ] **Step 6: Commit** `feat(frontend): brand hero with the route motif (U10)`.

---

### Task 6: Landing sections in Morpho's rhythm

**Files:**
- Create: `src/lib/landing/sections.ts`, `src/lib/landing/sections.test.ts`
- Create: `src/components/landing/SimulatorSection.tsx`, `src/components/landing/RouteSection.tsx`, `src/components/landing/LpIllustration.tsx`, `src/components/landing/SpIllustration.tsx`
- Modify: `src/components/landing/Landing.tsx`, `src/components/landing/HowItWorks.tsx`, `src/components/landing/TrustRow.tsx`, `src/components/landing/FinalCta.tsx`
- Delete: `src/components/landing/RouteLanes.tsx`
- Modify: `src/app/globals.css` (`--landing-space-section`: 3.5 rem, 5 rem from 1024 px)

**Interfaces:**
- Consumes: `Simulator`, `HeroChart` (unchanged props), `LP_RETURN_SOURCE`, `LP_RISKS`, `SP_RETURN_SOURCE`, `SP_RISKS` (`src/lib/routes/copy.ts`), `Highlight`, `useInView`, `Button`/`buttonClass` with `arrow`, Task 5's `.landing-frame` and `.frame-cross`.
- Produces:
  - `sections.ts`: `export type RouteSectionCopy = { route: "lp" | "sp"; pill: string; title: string; body: string[]; txs: string; illustration: "left" | "right" }`; `export const ROUTE_SECTIONS: readonly RouteSectionCopy[]` = LP (`pill: "MUSD/BTC LP"`, `title: "Earn swap fees"`, `body: [LP_RETURN_SOURCE, LP_RISKS[0]]`, `txs` = RouteLanes' LP line, `illustration: "right"`), SP (`"Stability Pool"`, `"Back the system"`, `[SP_RETURN_SOURCE, SP_RISKS[0]]`, RouteLanes' SP line, `"left"`).
  - `SimulatorSection({ data, error, highlight, onHighlight })`: `<section id="simulator">` owning `text`/`lastValid` amount state (moved from `Landing`/old `Hero`), `HeroChart` left and `Simulator` right from `lg`, stacked below (chart after the simulator below `lg`, as today).
  - `RouteSection({ copy, onHighlight }: { copy: RouteSectionCopy; onHighlight: (h: Highlight) => void })`: pill (`rounded-full` ring, `.eyebrow` text, `text-accent` or `text-sp`), H2 `text-headline`, paragraphs, `txs` in `text-xs text-muted`, button "Compare routes" → `#simulator` (`buttonClass("secondary")`, `arrow`); illustration in a `.landing-frame` panel on the `illustration` side from `md`, after the text below `md`; `onMouseEnter`/`onFocus` → `onHighlight(copy.route)`, leave/blur → `null`; `landing-reveal` with `useInView`.
  - `LpIllustration` / `SpIllustration`: `aria-hidden` inline SVG on the frame grid, `themeColor` only. LP: one MUSD bar splitting into two equal halves labelled "BTC" (`btc`) and "MUSD" (`accent`). SP: an MUSD block (`sp`) with small BTC dots (`btc`) arriving from above, labelled "MUSD in" / "BTC from liquidations". Labels at `CHART_FONT_PX`.
- `Landing` order: `Hero` → `SimulatorSection` → `RouteSection` × `ROUTE_SECTIONS` → `HowItWorks` → `TrustRow` → `FinalCta`. Section headings `text-headline`; FinalCta's `ConnectCta` gets `arrow`.

- [ ] **Step 1: Write the failing test** `sections.test.ts`: two sections in order lp, sp; illustration sides alternate (`right`, `left`); `body` equals the `copy.ts` constants (import and compare, so copy has one source); pills "MUSD/BTC LP", "Stability Pool"; titles "Earn swap fees", "Back the system".

- [ ] **Step 2: Run** `npx vitest run src/lib/landing/sections.test.ts` — expected: FAIL.

- [ ] **Step 3: Implement** `sections.ts`, the components, the `Landing` order, delete `RouteLanes.tsx`, update `HowItWorks`/`TrustRow`/`FinalCta` headings and buttons.

- [ ] **Step 4: Run** `npm test && npm run build` — expected: PASS, `/` ≤ 97 kB.

- [ ] **Step 5: QA:** 360/768/1024/1440 × both themes: no horizontal scroll; "Compare routes" (hero and sections) and "Try an amount ↓" land on `#simulator` below the sticky header; hovering the LP section highlights the LP line in the chart, SP likewise; keyboard focus on a section's button does the same; landing simulator parity: typing 500 shows the same rows as on `main`.

- [ ] **Step 6: Commit** `feat(frontend): landing sections in one rhythm (U10)`.

---

### Task 7: Whole-app QA and docs

**Files:**
- Modify: `AGENTS.md` (Frontend → Design system: motion tokens and guard, Button roll/arrow/pending contract, Skeleton/Settle, landing hero and sections; replace the U2 hero/Live strip/RouteLanes descriptions)
- Modify: `docs/STATUS.md` (U10 row, tests count, session log line)

- [ ] **Step 1: Build and serve** `npm run build` then serve `out/`.
- [ ] **Step 2: Playwright matrix** with the keyless mock EIP-1193 wallet on the QA accounts in `docs/STATUS.md`: pages `/`, dashboard (connected `/`), `/positions/`, `/route/lp/?amount=100`, `/route/lp/confirm/…`, `/route/stability-pool/?amount=100`, its confirm, `/positions/lp/exit/?percent=25`, `/positions/stability-pool/withdraw/?percent=100`, `/tx/?hash=<a known testnet hash>` × 360/768/1024/1440 × light/dark. Assert per page: `scrollWidth === innerWidth`; 0 console errors; header Connect/account width at 360 px equals `main`'s.
- [ ] **Step 3: Reduced motion** (`page.emulateMedia({ reducedMotion: "reduce" })`): on `/` and dashboard, after 2 s `document.getAnimations().length === 0` and every hero element is visible (opacity 1).
- [ ] **Step 4: Touch** (`hasTouch`, `isMobile` context at 390 px): tap a primary arrow button that does not navigate (e.g. `ConnectCta`, then close the modal): the first `.btn-label` has `transform: none` afterwards.
- [ ] **Step 5: Accessibility snapshot** of `/` and the LP confirm page: each button's name appears once ("Deposit to LP", not "Deposit to LP Deposit to LP"); while the mock wallet holds a permit/approval request, the stepper's live region text is "Check your wallet…" once.
- [ ] **Step 6: Pending sequence:** on the LP confirm page with an account that needs an approval (or permit), run the first step: its button shows the dot wave, then the check and "Done" for ≈1.2 s, then today's finished row; the final step shows the wallet phase, then the receipt page shows the dot wave, then the check. No React "state update on an unmounted component" warning.
- [ ] **Step 7: Update** `AGENTS.md` and `docs/STATUS.md`; run `npm test && npm run build` one last time and record the counts and the `/` First Load JS in STATUS.
- [ ] **Step 8: Check** `git status` for iCloud duplicates (`* 2.*`), then commit `docs: U10 motion system and brand hero in AGENTS and STATUS`.
