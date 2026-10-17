# U6 — One type scale, enforced in code

**Date:** 17 Oct 2026 · **Branch:** `feat/u6-type-scale` · **Status:** draft for user review

## Why

U1 and U3 agreed a type scale, but it lives only in spec prose. Nothing in code holds it, so pages drifted (audit of 17 Oct, on `main` at `bbbb736`):

- The page title is hand-copied as `text-[28px] font-semibold leading-[34px] tracking-tight` in 7 places (PageHeader, ReceiptPage ×4, PositionsPage, Card level 1).
- Off-scale sizes: 18 px (`text-lg`, 5 uses), 30 px (`text-3xl`, FinalCta), 13 px (`text-[13px]`, Simulator, added in U5).
- Landing section headings are 24 px; U3 §3.2 says section headings are 16 px. The landing has no written exception.
- The hero uses weight 700; U1 allows 400/500/600 only.
- Chart SVG text is 10–11 px; U1 sets 12 px as the floor.
- Line heights mix token-less values: `leading-6`, `leading-8`, `leading-snug`, `leading-[34px]`, `leading-[48px]`, `leading-[52px]`.

Colours already have this treatment: tokens in `src/lib/ui/tokens.ts`, read by Tailwind, guarded by `contrast.test.ts`. U6 gives type the same: **one scale, defined once, guarded by a test**, so the next agent cannot drift without a red test.

## Goals

1. Every font size in the app comes from one token set; each token carries its line height (and, for role tokens, weight and tracking).
2. A Vitest guard fails on any off-scale size, arbitrary line height, disallowed weight, or numeric SVG font size.
3. Every current usage is migrated, with the visual result checked in the browser.
4. `AGENTS.md` states the rule in one line so every agent follows it.

## Non-goals

- No change to font families (Inter for UI, JetBrains Mono for key figures, per U3 §3.2), colours, copy, or layout beyond what a size change causes.
- RainbowKit's modal keeps its own styles.
- No responsive fluid type (`clamp()`); fixed steps only.

## Anti-goals (a failure even if the build passes)

- Any page gains horizontal scroll at 360 px.
- A 20 px mono figure no longer fits its column at 360 px.
- The guard is so loose it passes today's drift, or so strict it blocks legitimate prose (`leading-relaxed` paragraphs).

## The scale (decided)

Tailwind's `theme.fontSize` is **replaced, not extended**, so off-scale classes such as `text-lg` stop existing. Tokens live in `src/lib/ui/tokens.ts` beside `colors`, and `tailwind.config.ts` reads them.

| Class | Size / line height | Weight | Tracking | Role |
|---|---|---|---|---|
| `text-xs` | 12 / 16 | per use | — | captions, footnotes, eyebrow-free meta, badge text |
| `text-sm` | 14 / 20 | per use | — | body text, labels, table cells, buttons |
| `text-base` | 16 / 24 | per use | — | lead body, panel and card headings (with `font-semibold`) |
| `text-xl` | 20 / 28 | per use | — | secondary figures (card asides, Live strip), the dashboard's "Next step" headline |
| `text-headline` | 24 / 32 | 600 | −0.025em | landing section headings |
| `text-title` | 28 / 34 | 600 | −0.025em | page titles (h1 in the app), the landing's closing CTA |
| `text-figure` | 28 / 32 | 500 | −0.025em | a panel's key figure (with `font-mono`, via `.figure`) |
| `text-display` | 40 / 48 | 700 | −0.025em | landing hero h1 below 640 px |
| `text-display-lg` | 48 / 52 | 700 | −0.025em | landing hero h1 from 640 px |

Rules that go with it:

- **Weights:** `font-normal` (400), `font-medium` (500), `font-semibold` (600). Weight 700 exists only inside the display tokens (the hero is the one display element; an approved U2/U3 look, now written down as the exception).
- **Line height** comes from the token. The only modifier allowed is `leading-relaxed`, for multi-line prose paragraphs (9 uses today, all prose).
- **Floor:** nothing below 12 px, SVG included. Chart text uses `CHART_FONT_PX` (12) exported from `tokens.ts`.
- **Mono** stays for key figures only (U3 §3.2, unchanged).
- This scale supersedes the "Type scale" row of U1 §(design tokens) and the "Scale" bullet of U3 §3.2. U1's 32 px step is dropped (unused); U3's 28 px title takes its place.

## Migration map (decided)

| Where | Now | After |
|---|---|---|
| `Hero` h1 | `text-[40px] font-bold leading-[48px] tracking-tight sm:text-[48px] sm:leading-[52px]` | `text-display sm:text-display-lg` |
| `PageHeader`, `ReceiptPage` ×4, `PositionsPage` h1, `Card` level 1 | `text-[28px] font-semibold leading-[34px] tracking-tight` | `text-title` |
| `Card` level 2 heading | `text-base leading-6 font-semibold tracking-tight` | `text-base font-semibold` |
| `.figure` (globals.css) | `text-[28px] font-medium leading-8 tracking-tight` | `font-mono text-figure` |
| Landing h2: RouteLanes, HowItWorks, TrustRow | `landing-section-title text-2xl tracking-tight` | `text-headline` |
| `FinalCta` h2 | `landing-section-title text-3xl tracking-tight` | `text-title` |
| `.landing-section-title` (Simulator's "Try an amount") | raw `font-size: 1rem; line-height: 1.5rem; font-weight: 600` | `@apply text-base font-semibold` |
| `RouteLanes` h3 ("Earn swap fees") | `text-lg font-semibold` | `text-base font-semibold` |
| `LiveStrip` figures | `text-lg sm:text-xl` | `text-xl` |
| `LpPositionCard` aside figure | `font-mono text-lg font-medium` | `font-mono text-xl font-medium` |
| `SpPositionCard` aside figure | `text-lg font-semibold` (sans) | `font-mono text-xl font-medium` — matches the LP card; it is a key figure (U3 §3.2) |
| `ReadinessCard` headline | `text-lg font-semibold leading-snug` | `text-xl font-semibold` |
| `Simulator` figure cells | `font-mono text-[13px]` | `font-mono text-sm` |
| `Simulator` amount input | `font-mono text-2xl font-semibold` | `font-mono text-headline` (same 24 px and weight; found by the guard's dry run) |
| `BtcMoveChart` SVG text | `fontSize` 10 (axis, bands) and 11 (values) | `CHART_FONT_PX` (12) everywhere; band labels show from a band height of 14 px (was 12) |
| `Logo` wordmark | `text-base font-semibold tracking-tight` | unchanged (on scale; tracking on a wordmark is fine) |

## The guard (decided)

`src/lib/ui/typography.test.ts`, run by `npm test`:

1. **Token checks:** every `fontSize` token is ≥ 12 px and carries a line height; any token with a weight uses 400/500/600, except `display` and `display-lg` (700).
2. **Source scan** over `src/**/*.{ts,tsx,css}` (test files excluded). Fails, listing `file:line` for each hit, on:
   - arbitrary sizes: `text-[<number>…]`;
   - removed Tailwind sizes: `text-lg`, `text-2xl` … `text-9xl`;
   - line heights other than `leading-relaxed` (`leading-[…]`, `leading-none|tight|snug|normal|loose`, `leading-<n>`);
   - weights outside the set: `font-thin|extralight|light|bold|extrabold|black`;
   - raw `font-size:` / `line-height:` in CSS;
   - numeric SVG sizes: `fontSize={<number>}`.
3. Written first (TDD): it must fail on today's tree with the hits listed in "Why", then pass after the migration.

## Verification

- `npm test` and `npm run build` pass (build includes lint and type check).
- Playwright on `web/out` with the keyless mock wallet (`docs/STATUS.md` → QA accounts), before/after screenshots at 360 / 768 / 1024 / 1440 px of: landing, dashboard (connected), positions with an LP and an SP position, LP route + confirm, SP route, receipt. Check: no horizontal scroll, the 20 px mono figures fit at 360 px, chart labels at 12 px don't collide at 360 px, 0 console errors.
- `AGENTS.md` → Design system line gains: "Type: one scale in `src/lib/ui/tokens.ts` (`fontSize`), guarded by `typography.test.ts`; weight 700 only in the hero's display tokens; `leading-relaxed` only for multi-line prose."
- `docs/STATUS.md` updated.

## Left to the builder

- Exact regexes in the guard, and how test files are excluded.
- Whether `.landing-section-title` keeps its name or is replaced by plain utilities at its one call site.
- The order of migration commits (one per area is fine).

## Calls made in this spec (for the user to check)

1. Landing section headings stay 24 px as a written landing exception (`text-headline`), instead of shrinking to 16 px: a marketing page needs a clearer heading hierarchy than the app's panels.
2. The closing CTA heading goes from 30 → 28 px (`text-title`) to land on the scale.
3. Weight 700 stays for the hero only, inside its tokens, rather than dropping the hero to 600.
4. All 18 px uses move to 20 px (`text-xl`), not down to 16, because they are figures or a headline that should stay prominent.
5. The SP card's aside figure becomes mono like the LP card's.
6. Chart text rises to 12 px to meet the floor.
