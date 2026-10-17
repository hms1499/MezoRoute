# U6 Type Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One type scale defined in `src/lib/ui/tokens.ts`, read by Tailwind, guarded by a Vitest scan, with every current usage migrated.

**Architecture:** Tokens sit beside `colors` in `tokens.ts`; `tailwind.config.ts` first *extends* `fontSize` with them (the four numeric steps equal Tailwind's defaults, so nothing moves), and switches to *replacing* `theme.fontSize` only once the guard proves no removed class is left. The guard is a source scan in Vitest; a temporary `PENDING` file set lets Task 2 commit green while landing files still wait for Task 3, which empties and deletes it.

**Tech Stack:** Next 14.2.35, Tailwind 3.4.19 (fontSize tuples with `lineHeight`/`fontWeight`/`letterSpacing`), Vitest, Playwright (MCP) for QA.

**Spec:** `docs/superpowers/specs/2026-10-17-u6-type-scale-design.md`

## Global Constraints

- Scale (size / line height, weight, tracking): `xs` 12/16 · `sm` 14/20 · `base` 16/24 · `xl` 20/28 · `headline` 24/32 600 −0.025em · `title` 28/34 600 −0.025em · `figure` 28/32 500 −0.025em · `display` 40/48 700 −0.025em · `display-lg` 48/52 700 −0.025em.
- Weights: 400/500/600 only; 700 only inside `display` and `display-lg`.
- Line height comes from the token; the only allowed modifier is `leading-relaxed` (multi-line prose).
- Nothing below 12 px, SVG included; chart text uses `CHART_FONT_PX` (12).
- Mono for key figures only (U3 §3.2). No change to families, colours, copy, or layout beyond size effects. RainbowKit's modal untouched.
- Repo rules (AGENTS.md): code/comments/commits in English; conventional prefixes (`feat(web):`, `test(web):`, `docs:`); run `cd web && npm test && npm run build`; never `next build` while `next dev` runs; check `git status` for iCloud `* 2.*` duplicates before committing.

## Review Focus

1. **20 px mono figures at 360 px** (Live strip's two columns, the Positions card asides): a reader expects every figure on one line inside its column with no horizontal page scroll → Task 4 Step 2 measures `scrollWidth === 360` and each figure's `scrollWidth <= clientWidth`.
2. **12 px chart labels at 360 px:** the "Today" labels of two close values must not overlap → `placeLabels` keeps its 14 px separation, which is ≥ the new 12 px glyph height; Task 3 Step 1 adds a geometry test that two labels at the same side are ≥ 14 px apart, and Task 4 screenshots the chart at 360 px.
3. **A removed class built in a `.ts` file** (e.g. a class map like `Button.tsx`'s `SIZES`, or `lib/**` helpers returning class strings): replacing `theme.fontSize` would silently drop its style → the guard scans `.ts` as well as `.tsx`/`.css` (Task 2 test `scans .ts files too`).
4. **Band labels** on the Trove CR chart need room for 12 px text: a band shorter than 14 px shows no label rather than clipped text → Task 3 Step 1 test.
5. **`.figure` via `@apply text-figure`**: the key figure must keep weight 500 and 32 px line height after the switch to `theme.fontSize` replacement → Task 4 Step 2 reads the computed style of one `.figure` on the dashboard.

---

### Task 1: Type tokens in `tokens.ts`, read by Tailwind

**Files:**
- Modify: `web/src/lib/ui/tokens.ts`
- Modify: `web/tailwind.config.ts`
- Test: `web/src/lib/ui/typography.test.ts` (create)

**Interfaces:**
- Produces: `export const fontSize: Record<FontSizeKey, [size: string, { lineHeight: string; fontWeight?: string; letterSpacing?: string }]>`, `export type FontSizeKey = "xs" | "sm" | "base" | "xl" | "headline" | "title" | "figure" | "display" | "display-lg"`, `export const CHART_FONT_PX = 12` — all from `@/lib/ui/tokens`.

- [ ] **Step 1: Write the failing token tests** in `typography.test.ts`, `describe("type tokens")`:

```ts
it("is exactly the spec's scale", () => {
  expect(fontSize).toEqual({
    xs: ["12px", { lineHeight: "16px" }],
    sm: ["14px", { lineHeight: "20px" }],
    base: ["16px", { lineHeight: "24px" }],
    xl: ["20px", { lineHeight: "28px" }],
    headline: ["24px", { lineHeight: "32px", fontWeight: "600", letterSpacing: "-0.025em" }],
    title: ["28px", { lineHeight: "34px", fontWeight: "600", letterSpacing: "-0.025em" }],
    figure: ["28px", { lineHeight: "32px", fontWeight: "500", letterSpacing: "-0.025em" }],
    display: ["40px", { lineHeight: "48px", fontWeight: "700", letterSpacing: "-0.025em" }],
    "display-lg": ["48px", { lineHeight: "52px", fontWeight: "700", letterSpacing: "-0.025em" }],
  });
});
it("never goes below 12 px", () => { /* every parseFloat(size) >= 12, and CHART_FONT_PX === 12 */ });
it("uses weight 700 only for the display tokens", () => { /* weights ⊂ {400,500,600} except display, display-lg */ });
```

- [ ] **Step 2: Run** `cd web && npx vitest run src/lib/ui/typography.test.ts` — Expected: FAIL (`fontSize` is not exported).
- [ ] **Step 3: Add `fontSize`, `FontSizeKey`, `CHART_FONT_PX` to `tokens.ts`** with a one-line comment pointing at the spec; in `tailwind.config.ts` add `fontSize` to `theme.extend` (imported from `./src/lib/ui/tokens`).
- [ ] **Step 4: Run** the test file — Expected: PASS. Then `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `feat(web): type scale tokens read by Tailwind (U6)`.

---

### Task 2: The guard, and the app's components on the scale

**Files:**
- Modify: `web/src/lib/ui/typography.test.ts`
- Modify: `web/src/components/ui/PageHeader.tsx:31`, `web/src/components/ui/Card.tsx:44`, `web/src/components/receipt/ReceiptPage.tsx:81,108,124,166`, `web/src/components/positions/PositionsPage.tsx:69`, `web/src/components/positions/LpPositionCard.tsx:21`, `web/src/components/stability-pool/SpPositionCard.tsx:29`, `web/src/components/dashboard/ReadinessCard.tsx:49`, `web/src/app/globals.css:50` (`.figure`)

**Interfaces:**
- Consumes: `fontSize` keys from Task 1 (`text-title`, `text-figure`, `text-xl`).
- Produces: in the test file, `const PENDING: ReadonlySet<string>` of `src`-relative paths still to migrate; Task 3 empties and deletes it.

- [ ] **Step 1: Write the guard**, `describe("type usage in source")`: walk `src/**/*.{ts,tsx,css}` with `node:fs` (skip `*.test.ts(x)`), and for each line collect hits of these named rules, reporting `path:line rule`:
  - `arbitrary size` — `/\btext-\[\d/`
  - `removed size` — `/\btext-(lg|[2-9]xl)\b/`
  - `line height` — `/\bleading-(?!relaxed\b)[\w[]/`
  - `weight` — `/\bfont-(thin|extralight|light|bold|extrabold|black)\b/`
  - `css size` — `/^\s*(font-size|line-height)\s*:/` (CSS files only)
  - `svg size` — `/fontSize=\{\d/`

  Tests: `it("finds no off-scale type outside PENDING")` → `expect(hits.filter(notPending)).toEqual([])`; `it("scans .ts files too")` → the walked file list contains `src/lib/ui/tokens.ts`; `it("catches each rule")` → feed one sample line per rule (e.g. `'className="text-[13px]"'`, `"text-3xl"`, `"leading-snug"`, `"font-bold"`, `"  font-size: 1rem;"`, `"fontSize={10}"`) to the matcher and expect one hit each, and `"leading-relaxed text-sm font-semibold"` to give none.

  Set `PENDING` to: `app/globals.css`, `components/landing/Hero.tsx`, `components/landing/HowItWorks.tsx`, `components/landing/TrustRow.tsx`, `components/landing/RouteLanes.tsx`, `components/landing/FinalCta.tsx`, `components/landing/LiveStrip.tsx`, `components/landing/Simulator.tsx`, `components/chart/BtcMoveChart.tsx`.
- [ ] **Step 2: Run** the file — Expected: FAIL on exactly the app hits: `PageHeader.tsx:31`, `Card.tsx:44`, `ReceiptPage.tsx:81,108,124,166`, `PositionsPage.tsx:69` (arbitrary size + line height), `LpPositionCard.tsx:21`, `SpPositionCard.tsx:29`, `ReadinessCard.tsx:49` (removed size; ReadinessCard also `leading-snug`). Any other hit means the regex is wrong or the audit missed a site — fix whichever before going on.
- [ ] **Step 3: Migrate** per the spec's map: page titles → `text-title` (keep `[text-wrap:balance]` where present); Card level 1 → `text-title`, level 2 → `text-base font-semibold`; LP aside → `font-mono text-xl font-medium`; SP aside → `font-mono text-xl font-medium`; ReadinessCard headline → `text-xl font-semibold`; `.figure` → `@apply font-mono text-figure`.
- [ ] **Step 4: Run** `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `feat(web): type guard; app titles and figures on the scale (U6)`.

---

### Task 3: Landing and chart on the scale; Tailwind's scale replaced

**Files:**
- Modify: `web/src/components/landing/{Hero,HowItWorks,TrustRow,RouteLanes,FinalCta,LiveStrip,Simulator}.tsx`, `web/src/components/chart/BtcMoveChart.tsx`, `web/src/lib/chart/move-chart.ts`, `web/src/app/globals.css` (`.landing-section-title`), `web/tailwind.config.ts`
- Test: `web/src/lib/chart/move-chart.test.ts`, `web/src/lib/ui/typography.test.ts`

**Interfaces:**
- Consumes: `CHART_FONT_PX` from Task 1; `PENDING` from Task 2.
- Produces: `export const BAND_LABEL_MIN_HEIGHT = CHART_FONT_PX + 2` (14) and `export function placeLabels(labels: ChartLabel[], y: (value: number) => number, plot: { top: number; bottom: number }): (ChartLabel & { y: number })[]` — both moved/exported from `move-chart.ts` (today `placeLabels` is private in `BtcMoveChart.tsx`) so they can be tested.

- [ ] **Step 1: Write the failing chart tests** in `move-chart.test.ts`: `it("keeps two labels on the same side at least 14 px apart")` — two `today` labels whose values map 4 px apart → `|a.y − b.y| >= 14`; `it("shows a band label only from 14 px of band height")` → `BAND_LABEL_MIN_HEIGHT === 14`.
- [ ] **Step 2: Run** `npx vitest run src/lib/chart` — Expected: FAIL (`placeLabels`/`BAND_LABEL_MIN_HEIGHT` not exported).
- [ ] **Step 3: Move `placeLabels` into `move-chart.ts`, export it and `BAND_LABEL_MIN_HEIGHT`**; in `BtcMoveChart.tsx` import them, replace every `fontSize={10|11}` with `fontSize={CHART_FONT_PX}`, and the band check `band.height >= 12` with `>= BAND_LABEL_MIN_HEIGHT` (band text `y` offset becomes `band.y + CHART_FONT_PX`).
- [ ] **Step 4: Migrate the landing** per the spec's map: Hero h1 → `text-display sm:text-display-lg text-ink`; RouteLanes/HowItWorks/TrustRow h2 → `text-headline text-ink` (drop `landing-section-title` there); FinalCta h2 → `text-title text-ink [text-wrap:balance]`; RouteLanes h3 → `text-base font-semibold`; LiveStrip value → `text-xl` (drop `text-lg sm:`); Simulator `text-[13px]` (2 sites) → `text-sm`, and its amount input `text-2xl font-semibold` → `text-headline` (line 63); `.landing-section-title` → `@apply text-base font-semibold text-ink` (raw `font-size`/`line-height`/`font-weight`/`color` lines removed).
- [ ] **Step 5: Delete `PENDING`** and its filter from the guard; switch `tailwind.config.ts` from `theme.extend.fontSize` to `theme.fontSize` (replace).
- [ ] **Step 6: Run** `npm test && npm run build` — Expected: all tests pass (guard reports `[]`), build passes, `/` First Load JS ≈ 92 kB.
- [ ] **Step 7: Commit** `feat(web): landing and chart on the type scale; Tailwind uses only the scale (U6)`.

---

### Task 4: Browser QA, docs

**Files:**
- Modify: `AGENTS.md` (Design system bullet), `docs/STATUS.md`

- [ ] **Step 1: Serve and capture.** `cd web && npm run build`, serve `web/out` (`python3 -m http.server <port> --bind 127.0.0.1`, restarted after each build). With the keyless mock wallet (`docs/STATUS.md` → QA accounts; testnet "can borrow" `0xe618…0D56` for the dashboard, user's MetaMask `0x375a…d6e8` for positions), take viewport screenshots at 360 / 768 / 1024 / 1440 px of: landing, dashboard (connected), `/positions/`, `/route/lp/?amount=10` and its confirm, `/route/stability-pool/?amount=10`, a receipt (`/tx/?hash=` of a hash from `PRODUCT_SPEC.md` §20). Compare each with the same page on `main`.
- [ ] **Step 2: Measure** on each page at 360 px with `page.evaluate`: `document.documentElement.scrollWidth === 360`; for every `.figure`, `.font-mono.text-xl` element `el.scrollWidth <= el.clientWidth`; on the dashboard, `getComputedStyle(document.querySelector(".figure"))` gives `fontWeight "500"`, `lineHeight "32px"`, `fontSize "28px"`; console has 0 errors. Expected: all true.
- [ ] **Step 3: Docs.** Add to `AGENTS.md` → Design system: "Type: one scale in `src/lib/ui/tokens.ts` (`fontSize`, `CHART_FONT_PX`), the only sizes Tailwind knows, guarded by `typography.test.ts`; weight 700 only in the hero's display tokens; `leading-relaxed` only for multi-line prose. Design: `docs/superpowers/specs/2026-10-17-u6-type-scale-design.md`." Update `docs/STATUS.md` (U6 row, test count, session log line).
- [ ] **Step 4: Commit** `docs: U6 type scale in AGENTS and STATUS`.
