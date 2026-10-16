# U3 One Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app read as the same product as the U2 landing. It goes dark on one palette, uses an "If BTC moves" chart as the shared signature, keeps one column per flow, and fixes the ten findings of the 16 Oct design review.

**Architecture:** Most of the restyle goes through the existing semantic Tailwind tokens (`tokens.ts`), so components change by value, not by class. New logic lives in pure, tested modules:

- `lib/exposure/moves.ts` for the price-move maths;
- `lib/chart/move-chart.ts` for SVG geometry;
- `lib/landing/hero-chart.ts`;
- `lib/compare/default-amount.ts`;
- `lib/routes/balance-recovery.ts`;
- `lib/positions/labels.ts`.

Components stay thin and are verified by Playwright QA with the keyless mock wallet, as in U1 and U2. The repo has no component tests (Vitest runs in `node`).

**Tech Stack:** Next 14.2.35 static export, React 18.3.1, Tailwind 3.4.19, RainbowKit 2.0.2, wagmi 2.19.5, viem 2.57.2, Vitest 5, lucide-react 1.49.0. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-16-u3-app-identity-design.md`. Read it first; section numbers below (§) refer to it.

## Global Constraints

- **No figure or behaviour changes.** Every quote, minimum, gas budget, simulation, and send path stays identical; U3 is visual and navigational only. Do not touch `src/lib/quote/`, `src/lib/tx/`, `src/lib/trove/borrow*.ts`, or any `*/gate.ts` decision order.
- **Palette** (§3.1, exact hex):

  | Token | Hex |
  |---|---|
  | `canvas` | `#0A1416` |
  | `surface` | `#162022` |
  | `inset` | `#0F1A1C` |
  | `line` | `#222B2D` |
  | `ink` | `#E8F1EF` |
  | `muted` | `#9FB3AF` |
  | `accent` (= LP) | `#2DD4BF` |
  | `onAccent` | `#062221` |
  | `sp` | `#A5B4FC` |
  | `btc` | `#FB923C` |
  | `danger` | `#F87171` |
  | `warning` (text) | `#FCD34D` |

- **Colour rules:**
  - Orange (`btc`) marks BTC exposure only.
  - The Stability Pool is `sp` (lavender) everywhere, including the landing.
  - Buttons are teal everywhere.
- **Contrast:** every text pair ≥ 4.5:1, enforced by `src/lib/ui/contrast.test.ts` through `TEXT_PAIRS`.
- **Fonts:**
  - Inter for UI and prose.
  - JetBrains Mono (`font-mono`) only for key figures: the big panel number, the amount input, chart labels, the simulator figures.
  - No mono labels or eyebrows, no `//` prefixes, no `route_N ·` labels, no `·`-joined meta strings in new copy.
- **Type scale** (px): page title 28/34 semibold, section heading 16/24 semibold, key figure 28/32 mono medium, body 14/20 and 16/24, caption 12/16; landing hero h1 stays 40/48 (`sm:` 48).
- **Surfaces:**
  - Panel = `bg-surface`, 1 px `border-line`, `rounded-2xl`, no shadow.
  - Section = no box, `border-t border-line pt-4` with an `h2` 16/24.
  - Inset = `bg-inset rounded-xl`.
  - The only shadow left is none; `MobileBar` uses a top hairline and a solid `bg-surface`.
- **Motion:** none added to the app; landing motion stays behind `prefers-reduced-motion: no-preference`.
- **Layout:** no horizontal scroll at 360 px; the 360 px header has 1 px to spare. One-column grids that become multi-column at `lg` need `grid-cols-1`.
- **Wallet tree stays client-only:** never import Passport, RainbowKit components, or wagmi hooks from a module that `layout.tsx`/`page.tsx` import statically (AGENTS.md).
- **Before every commit:**
  - `cd web && npm test` passes;
  - from Task 1 on, `npm run build` passes (it runs lint and the type check);
  - check `git status` for iCloud duplicates (`* 2.*`).
- **Commits:** conventional prefixes (`feat(web):`, `fix(web):`, `test(web):`, `docs:`), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A Trove that is already below MCR today, or that crosses MCR inside −30…+30%.** The CR plot must show the crossing dot and label "Liquidated below <liquidation price>", and the liquidatable message must stay visible outside the closed "Show figures" disclosure. Tested in Task 3 (`mcrCrossing`) and checked in Task 13 with the at-risk QA account.
2. **An account with no LP, no Stability Pool, and no Trove.** The chart must not render empty plots. `ExposurePanel` keeps its "No BTC exposure…" line, and `chartPlots` returns `[]`. Tested in Task 6.
3. **Wallet MUSD between 0 and 1, or above the network cap.** The Compare default is the 1,000 example below 1 MUSD, and `min(wallet, cap)` floored to whole MUSD otherwise. Testnet's cap is 1,000,000 and mainnet's 1,000. Tested in Task 8.
4. **A Bitcoin wallet (smart account) or a recovery-mode system on the LP route with too little MUSD.** "Borrow & Deploy instead" must not appear; the borrow mode is EOA-only (F4). Tested in Task 11.
5. **Very long figures at 360 px** (for example 14,172,031 MUSD or a 0.000000001 BTC gain) in mono key figures and chart end labels. They must wrap or drop the +30% label, never overflow. Tested by `chartLabels` dropping the right label below 400 px (Task 4) and checked in Task 13 at 360 px.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/ui/tokens.ts` (modify) | dark palette, `surface`/`inset`/`sp`/`onAccent`, `TEXT_PAIRS` |
| `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx` (modify) | tokens, `color-scheme: dark`, `.card` without shadow, `.figure` class |
| `src/components/surface.tsx` (delete) and its users | the light/dark switch is gone; chrome is always dark |
| `src/app/providers.tsx` (modify) | RainbowKit `darkTheme` |
| `src/components/ui/Card.tsx` (modify) | `level: "panel" \| "section"` |
| `src/lib/exposure/moves.ts` (+ test) | `MOVES`, `lpMoveFactor`, `moveScenarios`, `mcrCrossing` |
| `src/lib/chart/move-chart.ts` (+ test) | pure SVG geometry for the chart |
| `src/components/chart/BtcMoveChart.tsx` | renders the chart from geometry |
| `src/lib/landing/hero-chart.ts` (+ test) | the hero's two series from a `LandingSimulation` |
| `src/components/landing/HeroChart.tsx` | replaces `RouteMap.tsx` (deleted) |
| `src/lib/exposure/plots.ts` (+ test) | which plots and breakdown rows an exposure shows |
| `src/lib/compare/default-amount.ts` (+ test) | Compare routes default |
| `src/lib/config/networks.ts` (modify, + test) | `entryCap` per network |
| `src/lib/routes/balance-recovery.ts` (+ test) | recovery actions for a balance shortfall |
| `src/lib/positions/labels.ts` (+ test) | the oracle-vs-exit gap rule |
| `src/lib/dashboard/summary.ts` (+ test) (delete) | SummaryStrip data, no longer used |

---

### Task 1: Dark palette and always-dark chrome

**Files:**
- Modify:
  - `src/lib/ui/tokens.ts`
  - `tailwind.config.ts`
  - `src/app/globals.css`
  - `src/app/layout.tsx`
  - `src/app/providers.tsx`
  - `src/components/AppShell.tsx`
  - `src/components/Header.tsx`
  - `src/components/Footer.tsx`
  - `src/components/NetworkSwitch.tsx`
  - `src/components/ui/Button.tsx`
  - `src/components/ui/Skeleton.tsx`
  - `src/components/home/ConnectCta.tsx`
  - `src/components/landing/Landing.tsx`
  - every file in the `bg-white` / `text-white` list below
- Delete: `src/components/surface.tsx`
- Test: `src/lib/ui/contrast.test.ts` (unchanged; runs the new `TEXT_PAIRS`)

**Interfaces:**
- Produces:
  - Tailwind colours `canvas`, `surface`, `inset`, `line`, `ink`, `muted`, `accent` (`DEFAULT`, `soft`), `onAccent`, `sp` (`DEFAULT`, `soft`), `btc` (`DEFAULT`, `soft`), `danger` (`DEFAULT`, `soft`), `warning` (`bg`, `ink`).
  - `night.*` stays as aliases of the same values (`night.bg = canvas`, `night.panel = surface`, `night.line = line`, `night.ink = ink`, `night.muted = muted`, `night.lp = accent`, `night.sp = sp`, `night.onLp = onAccent`, `night.glow` unchanged), so landing classes keep working.
  - `.figure` CSS class in `globals.css`: `font-mono font-medium text-[28px] leading-8 tracking-tight` (§3.2 key figure).

- [ ] **Step 1: Write the failing contrast pairs.** In `tokens.ts`, replace `TEXT_PAIRS` with every pair the dark UI uses:
  - `ink` / `muted` / `accent` / `sp` / `btc` / `danger` / `warning.ink` on each of `canvas`, `surface`, `inset`;
  - `onAccent` on `accent`;
  - `ink` on `danger` (the danger button);
  - `accent` on `accent.soft`, `sp` on `sp.soft`, `btc` on `btc.soft`, `danger` on `danger.soft`, `warning.ink` on `warning.bg`;
  - `muted` on `line` (badge);
  - the three existing `NIGHT_DIM_OPACITY` pairs, recomputed over `surface`.

  Keep the old light hexes for now so the test fails on the new `surface`/`inset`/`sp` names.

- [ ] **Step 2: Run** `cd web && npx vitest run src/lib/ui/contrast.test.ts`. Expected: FAIL (type error or undefined colour for `surface`).

- [ ] **Step 3: Set the palette.**
  - Put the Global Constraints hexes into `colors`.
  - Make each `*.soft` / `warning.bg` the colour at 12% over `surface`, using the existing `mix(fg, surface, 0.12)`, so it stays a solid hex.
  - Add `night` as aliases.
  - In `tailwind.config.ts`, drop `boxShadow.card` and `boxShadow.raised`, and update the header comment to "One dark palette (U3)".

- [ ] **Step 4: Run the contrast test.** Expected: PASS, every pair ≥ 4.5 (spec measured the lowest at 6.0:1).

- [ ] **Step 5: Make the chrome always dark.**
  - `globals.css`:
    - add `html { color-scheme: dark; }`;
    - `.card` becomes `@apply rounded-2xl border border-line bg-surface p-5;`;
    - `:focus-visible` uses `accent` (the `.landing-dark` override goes);
    - add `.figure`.
  - `layout.tsx`: `body` keeps `bg-canvas text-ink`.
  - `AppShell`: drop `SurfaceProvider` and `Frame`'s `dark` branch. The landing keeps its glow by wrapping its own content in `bg-night-glow` inside `Landing.tsx`, full-bleed via a negative-margin wrapper or a fixed backdrop (builder's call; nothing else may change size).
  - Delete `surface.tsx` and every `useSurface`/`useDarkSurface` branch in `Header`, `Footer`, `NetworkSwitch`, `Button` (`nightOutline`/`nightGhost` variants stay as the outline and ghost styles), `Skeleton`, `ConnectCta`, `Landing`. Keep one branch: the dark one.
  - Replace every `bg-white` with `bg-surface` (or `bg-inset` for `AmountInput` and the pill toggles' track). Replace `text-white` on `accent` with `text-onAccent`.
  - Remove `shadow-card` / `shadow-raised` / `shadow-sm` uses (`SummaryPanel`, `ExitStepper`, `ModeToggle`, `RouteComparison` tabs, `Header` nav pill, `NetworkSwitch`, `ErrorToast`, `AppShell` skip link, `MobileBar`). Active pills become `bg-line text-ink`.
  - `ErrorToast` stays `bg-ink text-canvas` (light on dark, so it stands out).
  - The files that use `bg-white` or `text-white` today:
    - `ui/StepList.tsx`, `ui/PageHeader.tsx`, `ui/Button.tsx`, `ErrorToast.tsx`
    - `route/SummaryPanel.tsx`, `route/RouteLayout.tsx`
    - `stability-pool/SpWithdrawPage.tsx`
    - `lp/AmountInput.tsx`, `lp/ModeToggle.tsx`, `lp/AmountForm.tsx`
    - `AppShell.tsx`
    - `dashboard/RouteComparison.tsx`, `dashboard/SummaryStrip.tsx`
    - `positions/ExitStepper.tsx`, `positions/ExitForm.tsx`
    - `Header.tsx`, `NetworkSwitch.tsx`
  - `providers.tsx`: `darkTheme({ accentColor: colors.accent.DEFAULT, accentColorForeground: colors.onAccent, borderRadius: "large" })`.

- [ ] **Step 6: Verify.**
  - Run `cd web && npm test && npm run build`. Expected: all pass, First Load JS of `/` within ±3 kB of 92 kB.
  - Run `grep -rn "bg-white\|shadow-card\|shadow-raised\|useSurface\|useDarkSurface" src`. Expected: no output.

- [ ] **Step 7: Commit.** `feat(web): U3 one dark palette for landing and app; SP turns lavender`

### Task 2: Surface levels

**Files:**
- Modify:
  - `src/components/ui/Card.tsx`
  - `src/components/dashboard/{TroveCard,PositionsSummary,MainnetReferenceCard}.tsx`
  - `src/components/lp/{RisksCard,EntryPreviewCard}.tsx`
  - `src/components/stability-pool/SpRisksCard.tsx`
  - `src/components/ui/Notice.tsx`

**Interfaces:**
- Produces: `Card` prop `level?: "panel" | "section"` (default `"panel"`); `variant="reference"` stays and renders as a section with a dashed top hairline.

- [ ] **Step 1: Implement `level`.**
  - `"panel"` keeps the `.card` class.
  - `"section"` renders `<section className="border-t border-line pt-4">` with the same header slot and an `h2` of `text-base font-semibold` (16/24).
  - `variant="reference"` becomes `level="section"` plus `border-dashed`.

- [ ] **Step 2: Apply the levels.**
  - Sections: `TroveCard`, `PositionsSummary`, `MainnetReferenceCard` (reference), the LP "What happens" card (`EntryPreviewCard`), `RisksCard`, `SpRisksCard`.
  - `Notice` uses `bg-inset rounded-xl`.
  - Everything else stays a panel.
  - Type scale (Global Constraints): `PageHeader` and `Card headingLevel=1` titles become `text-[28px] leading-[34px] font-semibold`; panel and section `h2`s `text-base leading-6 font-semibold`; the key figure on each panel (BTC exposure total, the summary panel's "You receive"/"You deposit" value, the position headline) uses `.figure`.

- [ ] **Step 3: Verify.** Run `npm test && npm run build`. Expected: pass. Serve `web/out` (`python3 -m http.server 4173 --bind 127.0.0.1 -d out`) and take viewport screenshots of `/` (connected, mock wallet `0xe618…0D56`) and `/route/lp/?amount=500&slippage=0.5` at 1280 px. Check: Next step and Compare are boxed; Trove, Positions, and Mainnet today are not.

- [ ] **Step 4: Commit.** `feat(web): panel and section surface levels`

### Task 3: Price-move maths

**Files:**
- Create: `src/lib/exposure/moves.ts`
- Test: `src/lib/exposure/moves.test.ts` (reuse `src/lib/dashboard/test-fixtures.ts`)

**Interfaces:**
- Consumes: `exposure`, `type Exposure`, `lpValueAfterDrop` (`lib/exposure/exposure.ts`); `collateralRatio`, `liquidationPrice` (`lib/trove/health.ts`); `isqrt`, `WAD` (`lib/math`).
- Produces:
  - `MOVES: readonly number[]` = `[-30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30]`
  - `lpMoveFactor(movePercent: number): bigint`: `isqrt((100 + move) × WAD² / 100)`, a WAD factor.
  - `type MoveScenario = { move: number; price: bigint; lpValue: bigint; spValue: bigint; collateralRatio: bigint | null }`
  - `moveScenarios(snapshot: DashboardSnapshot, current: Exposure, moves?: readonly number[]): MoveScenario[]`: price `snapshot.price × (100 + move) / 100`; `lpValue = current.lpValue × lpMoveFactor(move) / WAD`; `spValue = current.spDeposit + current.spBtcGain × price / WAD`; CR from `collateralRatio(trove, price)`.
  - `mcrCrossing(snapshot: DashboardSnapshot): { price: bigint; move: number } | null`: the liquidation price, with `move` as the percent change from `snapshot.price` (one decimal, rounded toward zero), when it lies inside −30…+30. Otherwise `null`. Also `null` without a Trove.

- [ ] **Step 1: Write the failing tests.**
  - `lpMoveFactor(0) === WAD`.
  - For −10, −20, −30, `current.lpValue × lpMoveFactor(m) / WAD === lpValueAfterDrop(current.lpValue, -m)` (parity).
  - `lpMoveFactor(30) > WAD`.
  - `moveScenarios(...).length === 13`, and the `move: 0` row equals `current.lpValue`, `current.spValue`, and `collateralRatio(trove, price)`.
  - `spValue` is constant across moves when `spBtcGain === 0n`.
  - `collateralRatio` is `null` on every row without a Trove.
  - `mcrCrossing` is `null` for the healthy fixture (CR 337%, liquidation price 26,832 is −67%).
  - For a fixture Trove at CR 140%, it returns `{ price: liquidationPrice(trove, mcr), move: -21.4 }` (or the value the fixture gives; compute it in the test from `liquidationPrice`).
  - It returns `null` without a Trove.

- [ ] **Step 2: Run** `npx vitest run src/lib/exposure/moves.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `moves.ts` with the signatures above; round down everywhere (bigint division).

- [ ] **Step 4: Run the test.** Expected: PASS. Run `npm test`. Expected: all pass (`drawdownScenarios` untouched).

- [ ] **Step 5: Commit.** `feat(web): BTC price-move scenarios for the move chart`

### Task 4: Chart geometry and `BtcMoveChart`

**Files:**
- Create:
  - `src/lib/chart/move-chart.ts`
  - `src/components/chart/BtcMoveChart.tsx`
- Test: `src/lib/chart/move-chart.test.ts`

**Interfaces:**
- Produces:
  - `type Series = { id: "lp" | "sp" | "cr" | "lp-before" | "sp-before"; points: { move: number; value: number }[] }`. Values are plain numbers: MUSD as a float, CR as a percent.
  - `type Band = { from: number; to: number; tone: "danger" | "warning"; label: string }`
  - `chartGeometry(input: { series: Series[]; bands?: Band[]; width: number; height: number; pad?: { top: number; right: number; bottom: number; left: number } }): { x: (move: number) => number; y: (value: number) => number; paths: Record<string, string>; ticks: number[]; bandRects: { y: number; height: number; tone: Band["tone"]; label: string }[] }`
    - x domain fixed −30…+30;
    - y domain = min/max over series values and band edges, padded 8%;
    - `ticks` = 3 evenly spaced values (min, mid, max);
    - paths are `M…L…` polylines.
  - `chartLabels(input: { series: Series[]; width: number }): { id: Series["id"]; side: "left" | "right" | "today"; move: number; value: number }[]`: one label per non-"before" series at −30 and at 0 ("today"), plus +30 only when `width >= 400`.
  - `BtcMoveChart` props: `{ plots: { title: string; series: Series[]; bands?: Band[]; format: (value: number) => string; crossing?: { move: number; label: string } }[]; ariaLabel: string; children?: ReactNode }` (`children` = the disclosure table).
    - Each plot is an `svg` with `viewBox` from its measured width (`ResizeObserver`; fallback 320), height 160 (120 below 640 px).
    - Colours: `lp` → accent, `sp` → sp, `cr` → ink, `*-before` → the same colour at 35% opacity, dashed.
    - Danger and warning bands use `danger.soft` / `warning.bg` fills with a caption-size label.
    - The "Today" marker is a vertical hairline at x(0).
    - Labels in `font-mono text-xs`.
    - Wrapper `role="img"` with `aria-label={ariaLabel}`; the svg is `aria-hidden`.

- [ ] **Step 1: Write the failing tests.**
  - `x(-30) === pad.left`, `x(30) === width - pad.right`, `x(0)` is the midpoint.
  - `y(max)` is less than `y(min)` (SVG y grows down).
  - With bands, the y domain includes the band edges.
  - `paths.lp` starts with `M` and has 13 `L`/`M` commands for 13 points.
  - `chartLabels` drops the `right` labels at width 360 and keeps them at 400.

- [ ] **Step 2: Run** `npx vitest run src/lib/chart/move-chart.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `move-chart.ts`, then `BtcMoveChart.tsx` on top of it (no maths in the component).

- [ ] **Step 4: Run the tests and `npm run build`.** Expected: PASS.

- [ ] **Step 5: Commit.** `feat(web): BtcMoveChart, the shared "If BTC moves" chart`

### Task 5: Landing hero chart and landing cleanup

**Files:**
- Create:
  - `src/lib/landing/hero-chart.ts`
  - `src/components/landing/HeroChart.tsx`
- Delete: `src/components/landing/RouteMap.tsx`
- Modify:
  - `src/components/landing/{Hero,Simulator,Landing,RouteLanes,HowItWorks,TrustRow,LiveStrip,FinalCta}.tsx`
  - `src/app/globals.css` (remove `.landing-travel`, `landing-travel` keyframes)
- Test: `src/lib/landing/hero-chart.test.ts`

**Interfaces:**
- Consumes: `LandingSimulation` (`lib/landing/simulate.ts`), `MOVES`, `lpMoveFactor` (Task 3), `Series` and `BtcMoveChart` (Task 4).
- Produces: `heroSeries(sim: LandingSimulation | null): Series[]`.
  - `null` → `[]` (axes and the Today marker only).
  - LP unavailable → only `sp`.
  - Otherwise `lp` = `positionValue × lpMoveFactor(m) / WAD` and `sp` = `amount` at every move, both as MUSD floats (`Number(x) / 1e18`).

- [ ] **Step 1: Write the failing tests.**
  - `heroSeries(null)` is `[]`.
  - For a simulation built with `simulateRoutes` on the existing landing fixture:
    - the `sp` series is flat at the amount;
    - the `lp` value at move 0 equals `positionValue`;
    - at −30 it equals `valueAfterDrop` (parity with U2's stress row);
    - it is increasing in `move`.
  - LP `unavailable` gives only `sp`.

- [ ] **Step 2: Run** `npx vitest run src/lib/landing/hero-chart.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `heroSeries`.** Then make `Hero` own the amount text:
  - `Simulator` becomes controlled with props `{ text, onText, sim, error, onHighlight }`.
  - `Hero` holds `text` and the last valid amount in `useState` (this removes the ref written during render, a U2 deferral).
  - `Hero` computes `sim` once with `simulateRoutes`.
  - `HeroChart` renders `BtcMoveChart` with one plot titled "Value in MUSD if BTC moves":
    - `ariaLabel` like "If BTC falls 30%, the LP position is worth about 832.57 MUSD and the Stability Pool deposit stays at 1,000 MUSD";
    - highlight thickens the matching path (stroke 4 vs 2.5);
    - both paths get the `landing-draw` class.
  - Under the chart, two captions, one per route, each with a coloured dot: "LP: about half in BTC, so it moves with the price." / "Stability Pool: stays in MUSD; BTC arrives only from liquidations."
  - The chart keeps a fixed height while `sim` is null.

- [ ] **Step 4: Clean the landing copy** (§3.2, §6).
  - Remove the `// …` eyebrows and `route_N ·` labels.
  - The simulator's "simulate · no wallet needed" becomes the `h2` "Try an amount".
  - The trust row gets an `h2` "Before you connect".
  - The SP lane, legends, and simulator SP header use `sp` (lavender); nothing SP-related stays orange.
  - Remove `RouteMap`, the travelling dots, and their CSS.

- [ ] **Step 5: Verify.**
  - `npm test && npm run build` pass, including the `simulate.ts` parity test.
  - Viewport screenshots of `/` disconnected at 1280 and 390, normal and with `emulateMedia({ reducedMotion: "reduce" })`. The lines are visible without animation, and the SP line is flat.

- [ ] **Step 6: Commit.** `feat(web): landing hero shows the If BTC moves chart; SP flat, LP moves with BTC`

### Task 6: Exposure sections use the chart

**Files:**
- Create: `src/lib/exposure/plots.ts`
- Modify: `src/components/dashboard/ExposurePanel.tsx`
- Test: `src/lib/exposure/plots.test.ts`

**Interfaces:**
- Consumes: `moveScenarios`, `mcrCrossing` (Task 3); `Series`, `Band`, `BtcMoveChart` (Task 4); `CR_SAFETY_FLOOR` (`lib/trove/constants.ts`).
- Produces:
  - `breakdownSources(e: Exposure): ("trove" | "lp" | "sp")[]`: the sources with a non-zero amount, in that order.
  - `valueSeries(input: { lpValue: bigint; spDeposit: bigint; spBtcGain: bigint; price: bigint }, id?: "now" | "before"): Series[] | null`: the LP and SP lines over `MOVES` (ids `lp`/`sp`, or `lp-before`/`sp-before`); `null` when all three amounts are 0. `chartPlots` builds on it, and Positions (Task 9) calls it directly.
  - `chartPlots(input: { snapshot: DashboardSnapshot; before?: DashboardSnapshot }): { value: Series[] | null; cr: { series: Series; bands: Band[]; crossing: { move: number; price: bigint } | null } | null }`.
    - `value` is `null` without LP and SP.
    - With `before`, it adds `lp-before` / `sp-before` from the before snapshot.
    - `cr` is `null` without a Trove. Bands:
      - `{ from: 0, to: MCR%, tone: "danger", label: "Liquidation" }`;
      - `{ from: MCR%, to: 160, tone: "warning", label: "Below 160%" }`.

- [ ] **Step 1: Write the failing tests.**
  - `breakdownSources` is `["trove"]` for the Trove-only fixture and `["trove", "lp"]` with an LP.
  - `chartPlots` with no Trove, LP, or SP is `{ value: null, cr: null }`.
  - The Trove-only fixture gives `value: null` and a `cr` with 2 bands, the danger band ending at 110.
  - With `before`, the series ids include `lp-before`.
  - At-risk fixture: the crossing equals `mcrCrossing(snapshot)`.

- [ ] **Step 2: Run the test.** Expected: FAIL.

- [ ] **Step 3: Implement `plots.ts` and rework `ExposurePanel`.**
  - Title and total keep today's copy; the total uses `.figure text-btc`.
  - The breakdown `dl` renders only when `breakdownSources(current).length >= 2`.
  - The double-exposure `Notice` stays.
  - Then `BtcMoveChart` with plot "Value in MUSD" (if `value`) and plot "Trove CR" (if `cr`). The crossing label is `Liquidated below ${price(crossing.price)}`.
  - The existing table moves unchanged into `<details><summary>Show figures</summary>…</details>`, passed as `children`.
  - The liquidatable `<p>` and the footnote stay outside the `details`.
  - Same props as today, so `Dashboard`, `LpRoutePage`, and `SpRoutePage` need no change.

- [ ] **Step 4: Verify.**
  - `npm test && npm run build`.
  - Screenshots of `/` for `0xe618…0D56` (can borrow) and `0xDA04…aAaa` (at risk), and of `/route/lp/?amount=500&slippage=0.5` (before → after lines).
  - Open "Show figures" with the keyboard.

- [ ] **Step 5: Commit.** `feat(web): exposure sections show the move chart, table behind Show figures`

### Task 7: Dashboard: no SummaryStrip, one figure per view, mobile order

**Files:**
- Modify:
  - `src/components/dashboard/Dashboard.tsx`
  - `src/components/dashboard/ReadinessCard.tsx`
- Delete:
  - `src/components/dashboard/SummaryStrip.tsx`
  - `src/lib/dashboard/summary.ts`
  - `src/lib/dashboard/summary.test.ts`

- [ ] **Step 1: Remove the strip.** Delete `SummaryStrip`, `summary.ts`, and its test. The `ReadinessCard` footer line gains "MUSD in wallet <amount>" next to "BTC for gas".

- [ ] **Step 2: Reorder.** Make the grid one flat list of children with order classes:
  - mobile order: Readiness `order-1`, Exposure `order-2`, Trove `order-3`, Compare `order-4`, Positions `order-5`;
  - from `lg`: the left column (Readiness, Compare) spans 2 and the right column holds Exposure, Trove, Positions as today (for example `lg:col-span-2` items in `lg:grid-cols-3` with `lg:row-span-*`, or two columns with `contents` wrappers; builder's call, desktop placement must match today's);
  - `MainnetReferenceCard` stays last at all widths.

  Update `DashboardSkeleton` to match (no strip).

- [ ] **Step 3: Verify.** `npm test && npm run build`. Then screenshots at 1280 and 390 for `0xe618…0D56`. "0.099499" must appear exactly once in the page text; check with `page.evaluate(() => document.body.innerText.split("0.099499").length - 1)`. Expected: 1.

- [ ] **Step 4: Commit.** `feat(web): dashboard drops the summary strip; Trove before Compare on mobile`

### Task 8: Compare routes default amount

**Files:**
- Create: `src/lib/compare/default-amount.ts`
- Modify:
  - `src/lib/config/networks.ts`
  - `src/components/dashboard/RouteComparison.tsx`
- Test:
  - `src/lib/compare/default-amount.test.ts`
  - `src/lib/config/networks.test.ts` (existing; add a case)

**Interfaces:**
- Produces:
  - `NetworkConfig.entryCap: bigint`: testnet `1_000_000n * WAD`, mainnet `1_000n * WAD`, matching `Deploy.s.sol` `maxMusdInFor`.
  - `defaultCompareAmount(walletMusd: bigint, cap: bigint): { text: string; example: boolean }`.

- [ ] **Step 1: Write the failing tests.**
  - `defaultCompareAmount(0n, cap)` gives `{ text: "1000", example: true }`.
  - `defaultCompareAmount(WAD / 2n, cap)` gives the same (below 1 MUSD).
  - `defaultCompareAmount(2_427n * WAD + WAD / 3n, 1_000_000n * WAD)` gives `{ text: "2427", example: false }` (floored).
  - `defaultCompareAmount(5_000n * WAD, 1_000n * WAD)` gives `{ text: "1000", example: false }`.
  - `networks.testnet.entryCap === 1_000_000n * WAD` and `networks.mainnet.entryCap === 1_000n * WAD`.

- [ ] **Step 2: Run the tests.** Expected: FAIL.

- [ ] **Step 3: Implement and wire.**
  - `RouteComparison` initialises `text` with `defaultCompareAmount(snapshot.musd, network.entryCap).text`.
  - When `example` is true and the field still holds that value, a muted line under the input reads: "Example amount. You have 0 MUSD." Use the formatted balance when it is not zero but below 1, for example "You have 0.5 MUSD".
  - The "Enter an amount…" empty-state copy stays for a cleared field.

- [ ] **Step 4: Verify.** `npm test && npm run build`. The dashboard for `0xe618…0D56` shows both columns filled on load.

- [ ] **Step 5: Commit.** `feat(web): Compare routes starts with an amount`

### Task 9: One column per flow

**Files:**
- Modify:
  - `src/app/route/lp/confirm/page.tsx`
  - `src/app/route/stability-pool/confirm/page.tsx`
  - `src/app/tx/page.tsx`
  - `src/app/positions/page.tsx` (`Column width="wide"`)
  - `src/components/lp/LpConfirmPage.tsx`
  - `src/components/stability-pool/SpConfirmPage.tsx`
  - `src/components/receipt/ReceiptPage.tsx`
  - `src/components/positions/PositionsPage.tsx`

**Interfaces:**
- Consumes: `RouteLayout({ header, summary, mobileBar?, children })` (unchanged).

- [ ] **Step 1: Confirm pages.** Wrap in `Column width="wide"` and `RouteLayout`:
  - `header` = the `PageHeader`;
  - children = the review panel (`ConfirmSummary` / SP equivalent);
  - `summary` = the stepper panel (`EntryStepper` / `SpDepositStepper`).

  No `mobileBar`: below 1024 px the stepper simply follows the review, as today.

- [ ] **Step 2: Receipt.** `Column width="wide"` and `RouteLayout`:
  - children = status and details;
  - `summary` = a panel holding the `Actions` buttons plus "Back to dashboard".

  The invalid-hash state stays in `Column` narrow.

- [ ] **Step 3: Positions.** `Column width="wide"` and `RouteLayout` (no stepper):
  - children = position panels and fees;
  - `summary` = the totals (value, BTC exposure) and a `BtcMoveChart` with one "Value in MUSD" plot from `valueSeries({ lpValue: view.lp.value, spDeposit: sp?.deposit ?? 0n, spBtcGain: sp?.gain ?? 0n, price })` (Task 6). Use the positions snapshot's oracle price and the `SpView` field names as they are in `lib/stability-pool/position.ts`. No CR plot, since `/positions` is positions-only.

  The empty state stays narrow.

- [ ] **Step 4: Verify.** `npm run build`. Playwright at 1280: on `/route/lp/?amount=500&slippage=0.5` → `/route/lp/confirm/…` → `/tx/?hash=…`, the back link's `getBoundingClientRect().left` is equal on all three. Expected: one value (88 px at 1280).

- [ ] **Step 5: Commit.** `feat(web): every flow page keeps the same column`

### Task 10: One numbered sequence per page

**Files:**
- Modify:
  - `src/components/ui/StepList.tsx`
  - `src/components/ui/PageHeader.tsx`
  - `src/components/receipt/ReceiptPage.tsx`
  - `src/lib/ui/step-visual.ts`
- Test: `src/lib/ui/step-visual.test.ts`

**Interfaces:**
- Produces:
  - `PageHeader` prop `stepStatus?: "pending" | "done" | "failed" | "unconfirmed"`, applying to the current step's node: spinner / check / X / amber ring.
  - `receiptHeader(state: ReceiptState): { step: 3; stepStatus: "pending" | "done" | "failed" | "unconfirmed" }` in `step-visual.ts`.

- [ ] **Step 1: Write the failing test.** `receiptHeader("pending")` gives `{ step: 3, stepStatus: "pending" }`, `"confirmed"` gives `"done"`, `"failed"` gives `"failed"`, and `"unconfirmed"` gives `"unconfirmed"`.

- [ ] **Step 2: Run the test.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - `StepList`'s `StepNode` drops the number for `current` and `upcoming`: an `upcoming` node is an empty `border-line` ring and a `current` node an `accent` ring with a filled centre dot. The list stays an `<ol>`.
  - `ReceiptPage` deletes `Timeline` and `LAST_STAGE`, and passes `receiptHeader(state)` to `PageHeader`. `aria-current="step"` stays on step 3, and the status sentence below the title keeps its wording.

- [ ] **Step 4: Verify.** `npm test && npm run build`. Screenshots of a confirm page and a receipt show only the header's 1-2-3.

- [ ] **Step 5: Commit.** `feat(web): one numbered sequence per page; receipt shows Done`

### Task 11: Blocked balance offers the way out

**Files:**
- Create: `src/lib/routes/balance-recovery.ts`
- Modify:
  - `src/lib/errors/types.ts`
  - `src/components/lp/BlockNotice.tsx`
  - `src/components/lp/LpRoutePage.tsx`
  - `src/components/stability-pool/SpRoutePage.tsx`
- Test: `src/lib/routes/balance-recovery.test.ts`

**Interfaces:**
- Consumes:
  - `isRecoveryMode`, `borrowLimit` (`lib/trove/borrow.ts`);
  - `walletCapabilities(walletKind).borrowAndDeploy`;
  - `MIN_USABLE_MUSD` (`lib/dashboard/readiness.ts`);
  - `network.mezoAppUrl`.
- Produces:
  - `type BalanceAction = { kind: "borrow-instead"; amount: bigint } | { kind: "use-balance"; amount: bigint } | { kind: "get-musd"; href: string }`
  - `balanceRecoveries(input: { route: "lp" | "sp"; amount: bigint; walletMusd: bigint; canBorrowAndDeploy: boolean; borrowLimit: bigint; recoveryMode: boolean; mezoAppUrl: string }): BalanceAction[]`
    - `borrow-instead` with `amount = min(amount, borrowLimit)` only for `route === "lp" && canBorrowAndDeploy && !recoveryMode && borrowLimit >= MIN_USABLE_MUSD`;
    - then `use-balance` with `walletMusd` when `walletMusd > 0n`;
    - `get-musd` only when the list is otherwise empty;
    - at most two items.
  - `BlockNotice` new optional prop `actions?: { label: string; onClick?: () => void; href?: string }[]`.

- [ ] **Step 1: Write the failing tests.**
  - EOA with room 479.9 on LP, amount 500, wallet 0: `[{ kind: "borrow-instead", amount: 479.9e18 }]`.
  - Same with wallet 20: borrow first, then `use-balance` 20.
  - Smart account (`canBorrowAndDeploy: false`), wallet 0: `[{ kind: "get-musd", href }]`.
  - `recoveryMode: true`: no borrow-instead.
  - `route: "sp"`: never borrow-instead.
  - Room below `MIN_USABLE_MUSD`: no borrow-instead.

- [ ] **Step 2: Run the test.** Expected: FAIL.

- [ ] **Step 3: Implement and wire.**
  - In `LpRoutePage`, when `preview.block?.kind === "insufficient-balance"`, build the actions:
    - "Borrow & Deploy instead" calls `update({ ...intent, mode: "borrow", amount: <formatted amount> })`;
    - "Use my balance (N MUSD)" sets the amount to the exact wallet balance;
    - "Get MUSD in the Mezo app" is an external link.
  - Pass the actions to the `BlockNotice` in both `SummaryPanel` and `MobileBar`.
  - Do the same in `SpRoutePage` (no borrow).
  - The `borrowLimit` input uses the LP route snapshot's `maxMusdIn`, the same call `preview.ts` makes.
  - Add nothing to the toast's `Recovery` list; these actions belong to the notice only.

- [ ] **Step 4: Verify.** `npm test && npm run build`. For `0xe618…0D56`, `/route/lp/?amount=500&slippage=0.5` shows "Borrow & Deploy instead"; clicking it switches to Borrow & Deploy with 479.9. `/route/stability-pool/?amount=500` shows "Get MUSD in the Mezo app".

- [ ] **Step 5: Commit.** `feat(web): balance shortfall offers Borrow & Deploy, your balance, or the Mezo app`

### Task 12: Positions labels

**Files:**
- Create: `src/lib/positions/labels.ts`
- Modify:
  - `src/components/positions/PositionsPage.tsx`
  - `src/components/positions/LpPositionCard.tsx`
  - `src/components/stability-pool/SpPositionCard.tsx`
- Test: `src/lib/positions/labels.test.ts`

**Interfaces:**
- Produces: `showsExitGap(valueAtPrice: bigint, exitMusd: bigint): boolean`, true when `|value − exit| × 1000 > value × 5` (more than 0.5%); false when `value === 0n`.

- [ ] **Step 1: Write the failing test.**
  - `showsExitGap(2_0408n * 10n ** 14n, 1_9966n * 10n ** 14n)` is true (2.17%).
  - `showsExitGap(1000n * WAD, 998n * WAD)` is false (0.2%).
  - `showsExitGap(0n, 0n)` is false.

- [ ] **Step 2: Run the test.** Expected: FAIL.

- [ ] **Step 3: Implement and relabel** (exact copy from §5.6):
  - The header "Value (estimated)" becomes "Value at the BTC price", with the caption "Oracle price, before exit costs".
  - The header "BTC exposure" becomes "BTC exposure in these positions".
  - In `LpPositionCard`, the headline label matches the header.
  - "If you exit everything now" becomes "Exit to MUSD now", with the sub "Estimated, after the pool fee and price impact".
  - When `showsExitGap`, add a muted line: "Exiting sells the BTC half at the pool price, which differs from the oracle."
  - Cost-basis skeletons (LP and SP) become `<span role="status">Reading your history…</span>` next to the skeleton bar.

- [ ] **Step 4: Verify.** `npm test && npm run build`. `/positions/` for `0x375a…d6e8` shows the new labels and the gap line.

- [ ] **Step 5: Commit.** `feat(web): positions say which value is oracle and which is exit`

### Task 13: Header account button, full QA, docs

**Files:**
- Modify:
  - `src/components/Header.tsx`
  - `AGENTS.md` (Frontend → replace the U1/U2 design lines' colour rules with U3's; add a U3 line)
  - `docs/STATUS.md`

- [ ] **Step 1: Header.** In the connected branch of `ConnectButton.Custom`, render the app's own `Button size="sm" variant="secondary"` with a lucide `Wallet` icon and `account.displayName` shortened to `0x` + 2 + `…` + 2 below 640 px, full `displayName` above. It calls `openAccountModal`. This removes RainbowKit's emoji avatar.

- [ ] **Step 2: Measure the 360 px header.** In Playwright at 360 px, `document.querySelector("header").scrollWidth <= 360 - 32`. Expected: true connected and disconnected, on testnet and mainnet.

- [ ] **Step 3: Full QA matrix** (spec §7).
  - Every screen at 360, 390, 768, 1280 on testnet and mainnet, with these mock accounts:
    - `0xe37c…6b74` (no Trove);
    - `0xe618…0D56` (can borrow);
    - `0xDA04…aAaa` (at risk: the crossing label must show);
    - `0x375a…d6e8` (positions);
    - mainnet `0xDc88…6aD1`.
  - Check:
    - `document.documentElement.scrollWidth <= innerWidth` everywhere;
    - a focus ring on every tab stop (screenshot 5 stops per page);
    - reduced motion: no animation;
    - the RainbowKit modal is dark;
    - "Show figures" opens by keyboard;
    - the flow's left edge is the same (Task 9).
  - Use viewport or element screenshots, not full-page.

- [ ] **Step 4: Docs.**
  - `AGENTS.md` Frontend:
    - replace "Design system (U1): colour tokens…" with the U3 palette rule: one dark palette; orange = BTC only; SP = lavender; panels and sections; mono for key figures only;
    - add a U3 line naming `BtcMoveChart`, `moves.ts`, `move-chart.ts`, `balance-recovery.ts`, and the spec path;
    - remove the `useDarkSurface` sentence.
  - `docs/STATUS.md`:
    - U3 row → Done;
    - delete the closed deferrals listed in spec §8;
    - add the session log line.

- [ ] **Step 5: Verify and commit.** `npm test && npm run build` pass. Commit `docs: U3 done: QA result, agent guide and status`.
