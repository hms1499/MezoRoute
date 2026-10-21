# U10: one motion system, one button, one loading pattern, and a brand hero

Date: 21 Oct 2026 · Status: design approved in chat, awaiting spec review · Deadline context: Wave 1 submission 26 Oct 2026 22:00 (target 25 Oct)

## Intent

The user wants MezoRoute to feel as finished as morpho.org. What they like there is not one component but the consistency: every button, transition, and loading state moves the same way. U10 brings that consistency to the whole app (landing, dashboard, route flows, positions), then rebuilds the landing's first screen as a brand hero.

The user picked every visual direction in the brainstorm companion (mockups kept in `.superpowers/brainstorm/21235-1792549506/content/`: `buttons.html`, `loading.html`, `hero-v2.html`; git-ignored, open them as reference).

### What morpho.org does (measured 21 Oct 2026 at 1440 px)

- One easing curve, `cubic-bezier(0.36, 0.2, 0.07, 1)`, used by almost every transition (69 rules); durations are 0.2 s (small elements) and 0.4 s (buttons).
- Buttons are 40 px pills whose label is rendered twice; on hover the first copy slides up and out while the second slides in from below. Buttons with an arrow carry it in a filled circle; on hover the arrow slides out to the right and a second arrow slides in from the left (`transform 0.5s cubic-bezier(0.2, 0, 0, 1)`).
- Display type is light (weight 300, ≈59 px) against small uppercase tracked labels.
- One recurring motif (a fine grid with `+` marks on frame corners, line art) appears in the hero and in every illustration.
- Sections follow one rhythm: pill label → H2 → paragraph → button, illustration alternating sides.

## Goals

1. **One motion language** across the app: one easing curve and three durations, defined once and used everywhere.
2. **One button** (the user's pick, "B"): label roll on hover, arrow-in-a-circle swap on forward buttons, press feedback.
3. **One loading pattern** for data (pick "B"): the skeleton breathes, then values settle into place one after another.
4. **One pending pattern** for wallet actions (pick "B"): the button stays, its label rolls to the state, the circle shows a dot wave, then a check.
5. **A brand hero** on the landing (pick "B"): light headline, the MezoRoute route motif, two live figures; the simulator moves to the first section below it.
6. A Morpho-like **section rhythm** on the rest of the landing.

## Non-goals

- No new features, routes, contract or data changes.
- No change to the colour palettes, the type scale's sizes, or the dark/light mechanism (U9).
- No fluid, viewport-scaled root font size (morpho.org sets `html { font-size: 0.925px }` at 1440 px; it would break the 360 px layouts tuned in U4–U9).
- No figure-font change: key figures stay mono (`.figure`), labels stay sans (AGENTS rule).
- No new header items (the mockup's "How it works" nav link was illustrative).

## Anti-goals (failure even if it "works")

- Motion that runs under `prefers-reduced-motion: reduce`, or content that stays hidden there.
- A button that grows wider than today at 360 px in the header, or any horizontal page scroll at 360 px.
- Screen readers hearing a button label twice (the duplicate label must be `aria-hidden`).
- Values re-animating on every 15 s refetch or every keystroke in the simulator.
- A pending button that looks disabled/greyed while it is in fact waiting (the user's pick keeps full colour), or one that loses the polite live announcement the stepper has today.
- Any regression of the WagmiProvider/wallet-tree rules in AGENTS (the landing is inside the client-only tree; nothing here touches providers).

## Constraints

- Stack and rules in `AGENTS.md` → Frontend apply: tokens only (`palette-guard.test.ts`, `typography.test.ts`, `contrast.test.ts`), `motion-safe:` for animations, `lucide-react` icons `aria-hidden`, `Card`/`Column`/`RouteLayout` layout rules, 360 px minimum width.
- The global `prefers-reduced-motion: reduce` rule at the end of `globals.css` stays.
- `npm test && npm run build` must pass; First Load JS of `/` is 92 kB today, keep it within +5 kB (no animation library; CSS and small React only).
- Playwright QA on the local build at 360/768/1024/1440 px, both themes, reduced motion, keyboard, mock wallet (AGENTS → QA yourself first).

## Design

### 1. Motion tokens

One source in `src/lib/ui/motion.ts` (TS) mirrored as CSS variables in `globals.css` (or written by the Tailwind plugin like the palettes; builder's choice, but one source of truth with a test that the two agree):

| Token | Value | Use |
|---|---|---|
| `--ease-smooth` | `cubic-bezier(0.36, 0.2, 0.07, 1)` | every transition and reveal |
| `--ease-swift` | `cubic-bezier(0.2, 0, 0, 1)` | only the button's arrow swap (Morpho's pairing) |
| `--motion-fast` | 200 ms | colour, border, opacity of small controls (tabs, chips, inputs, links) |
| `--motion-base` | 400 ms | buttons (label roll, background), skeleton fade-out |
| `--motion-slow` | 600 ms | reveals, value settle, arrow swap (500 ms in Morpho; 600 is acceptable, builder may keep 500 as a named exception) |

Tailwind exposes them (`ease-smooth`, `duration-fast/base/slow`) so components never write `ease-out`, `ease-in-out`, `duration-150`, or a raw `cubic-bezier`. A guard test (like `typography.test.ts`) fails on raw easing keywords/curves and on `duration-<number>` classes outside the token files. Existing landing motion (`--landing-motion-*`, `LANDING_MOTION_MS`, `landing-rise/reveal/draw/fill/ping/flash`) is remapped onto the tokens; long one-off timings that are not transitions (chart draw 1200 ms, live pulse, count-up) may stay as named constants in `motion.ts` but use `--ease-smooth` (or its JS equivalent for `countUpAt`; `easeOutCubic` is replaced by a cubic-bezier evaluator of the same curve, tested at a few points).

### 2. Button

`Button`/`ButtonLink` in `src/components/ui/Button.tsx` stay the app's one button; variants and sizes keep their names and colours.

- **Label roll (every variant except `icon` size):** the label renders twice in a one-line, overflow-hidden grid; the second copy is `aria-hidden`. On hover/focus-visible the first slides to −100 % and fades, the second comes from +100 % (400 ms, `--ease-smooth`). Non-string children (icon + text) roll as a unit.
- **Arrow circle (forward buttons only):** a new opt-in prop (e.g. `arrow`) renders a 32 px circle at the trailing edge (padding becomes `pl-5 pr-1.5`) holding two `ArrowRight` icons; on hover the first slides out right, the second in from the left (`--ease-swift`), the circle scales to 1.06. Primary: circle `surface`-on-`accent` (white circle, accent arrow, as in the mockup); secondary/outlined: `accent` circle, `onAccent` arrow. Contrast of the arrow on its circle must pass the existing contrast test (add the pair).
  - Forward buttons that get the circle: landing CTAs, "Compare routes", route "Continue"/"Review" style buttons that navigate to the next step, Positions → exit/withdraw entry links. Builder lists them in the plan.
  - Never on: header Connect/account buttons, `icon` size, Max/percent presets, Cancel/back, external links (keep the `ExternalLink` glyph), `danger`.
- **Press:** `active:scale-[0.97]` under `motion-safe` (200 ms). Note the typography guard does not cover `scale`; any arbitrary value still goes through a token or a named class.
- **Touch:** no hover roll on `(hover: none)` devices (avoid a stuck rolled state after tap).
- Header buttons keep their current width at 360 px (measure before/after).

### 3. Pending (wallet) state

Today `Button` shows a `LoaderCircle` and is disabled when `loading`; `StepList` hides the action button and shows "Check your wallet…"/"Confirming…" text while a step is in the wallet or confirming.

New behaviour (pick "B"):

- `Button` gains a pending presentation: the label rolls to a status text (`Check your wallet` → `Confirming` as today's copy), the circle (or, for buttons without an arrow, a trailing 32 px circle that appears) shows a three-dot wave, and on success the circle shows a `Check` and the label rolls to `Done`. Full colour while pending; `aria-busy="true"`, `aria-disabled="true"`, clicks ignored.
- `StepList`: the active step keeps its button through `wallet` → `confirming` (instead of swapping it for text). The `aria-live="polite"` region keeps announcing the same status strings as today; the rolled label is visual and the live region is the accessible source (no double announcement: the button's own text change must not be inside the live region).
- **Where the sequence actually plays (builder check, settled by Claude):** every write flow navigates to `/tx/?hash=…` as soon as it has a hash (`useEntryFlow`, `useExitFlow`, `useSpDepositFlow`, `useSpActions`, `useClaimFees`), so a flow's last step and the one-shot buttons (`FeesCard`, `SpPositionCard`, `SpWithdrawPage`) only ever show the wallet phase before the page changes. That stays: no flow hook, `confirmCall`, or receipt-tracking change. The full wallet → confirming → check sequence plays on intermediate steps (approve, permit, borrow authorisation). The receipt page's "Confirming…" heading gets the same dot-wave glyph beside it, turning into the check when confirmed, so the pattern continues across the navigation.
- **A finished intermediate step (settled by Claude):** the stepper advances `active` as soon as a step is done (signature steps have no confirming phase). StepList keeps a per-step "just finished" flag: the finished step's button shows the check and rolls to "Done" for ≈1.2 s, then the row returns to today's glyph-only finished row while the next step's button appears. The live region announces "Done" once, as today. No stacked "Done" pills.
- The `StepNode` glyphs stay as they are (they are the step's status column, not a button).
- Failed/cancelled states keep today's behaviour ("Try again", neutral cancel note).
- `Button loading` users (`SpWithdrawPage`, `SpPositionCard`, `FeesCard`) move to the same pending presentation (wallet phase). `WrongNetworkAlert` is a chain switch: it gets the dot wave while the switch is pending and no check.
- Reduced motion: no roll, no wave; the label and glyph switch instantly.

### 4. Data loading

`Skeleton`/`SkeletonCard`/`LoadingCard` keep their API.

- **Skeleton:** replace the shimmer with a breathing opacity (1 → 0.45, 1.6 s, alternate, `--ease-smooth`) under `motion-safe`; static under reduced motion. Colour stays `line`.
- **Settle-in:** a small shared primitive (e.g. `<Reveal index={n}>` or a `settle` class with `--i`) makes content that replaces a skeleton fade in and rise 8 px over 600 ms, staggered 60 ms by index. Used where a skeleton is swapped for content: dashboard snapshot cards, Live figures in the hero, positions cards, route summary panels, Compare routes rows. Builder lists the call sites in the plan (16 files import `Skeleton`/`LoadingCard` today).
- **Only on first arrival:** refetches (15 s route snapshots, dashboard refresh) and simulator keystrokes never replay the settle; the existing count-up and `landing-flash` behaviours for changed values remain, retimed to the tokens.

### 5. Brand hero (landing)

Replaces today's `Hero` grid (headline + chart left, simulator right).

- **Frame:** a full-column panel (same width as today's content, `max-w-6xl`) with a fine grid background (20 px cells, `line` colour, ≈70 % opacity) and `+` marks on its four corners (`accent`, 60 % opacity), no shadow. Height ≈520 px at ≥1024 px.
- **Copy (left):** H1 in two lines, "Route MUSD." / "Know the BTC risk." (the user saw this wording; the builder may keep today's "Pick a route." if the copy review prefers, flag it), weight 300 (see §7), `display-lg` from 640 px, `display` below; the existing lead paragraph; two buttons: primary `ConnectCta` (with arrow circle) and secondary "Compare routes" scrolling to the simulator section (with arrow circle). When a wallet is already connected the landing is not shown (unchanged), so the CTA set needs no connected state.
- **Live figures (bottom-left, under the CTAs):** "MUSD/BTC pool" and "Stability Pool" from `useMainnetReference` (same values and formats as today's Live strip: `formatToken(…, 18, 0) MUSD`, `compactMusd`), labels small uppercase tracked sans (`text-xs`, `tracking-wide`, `font-medium`, muted), values `.figure`. Each figure keeps the Live strip's sub-line (settled by Claude after the builder check, so no content is lost): under the pool, the fees-only 30-day LP return with its "≈x a year, fees only" rate (today's `liveStrip().lpFees`; this is not the simulator's "Last 30 days", which is the value change of the user's amount); under the Stability Pool, "x% of MUSD supply". Loading: skeletons + settle; read failure: the figures are absent (as the Live strip is hidden today). `liveStrip()` in `lib/landing/view.ts` and its tests stay, reshaped to the hero's needs.
- **Route motif (right half):** inline SVG, decorative (`aria-hidden`), colours through `themeColor` (U3/U9 rule). Twelve hairlines enter from the left half (fading in from transparent), converge into a pill node labelled "MezoRoute", and split: six into the LP lane (top right, `accent`) and six into the Stability Pool lane (bottom right, `sp`); small lane labels "LP" / "Stability Pool" at the right edge. Dots travel along the lines (`stroke-dasharray` dash animation, ≈4 s linear loop, staggered) under `motion-safe` only; static lines under reduced motion. The motif must not run under the copy at any width.
- **Below 1024 px:** frame height becomes auto; the motif sits under the copy at a reduced height (≈200 px at 360 px), never overlapping text; the figures stack in two columns.
- **Entry motion:** headline lines, paragraph, buttons, figures rise in with the settle primitive (stagger), the motif lines draw in once (`landing-draw`, retimed).
- **Peek row:** under the frame, a hairline with "Try an amount ↓" (link to the simulator section) and the Live strip's caption ("Live from Mezo mainnet. Past results, not a forecast.", today's `liveStrip().caption` when data is in).
- The hero no longer renders `HeroChart` or `Simulator`.

### 6. Landing sections after the hero

Order: Hero → Simulator section → LP section → Stability Pool section → How it works → Trust → Final CTA. The Live strip is removed: its figures, sub-lines, and caption move into the hero (§5), and "Executor verified" (with its explorer link) moves into the Trust row if it is not already there.

- **Simulator section (`id` target of "Compare routes"):** today's `Simulator` card and the "If BTC moves" `HeroChart` side by side from 1024 px (chart left, simulator right, as in today's hero), stacked below. State (amount, highlight) moves from `Hero` to this section or to `Landing`; the parity tests of `simulate.ts` are untouched.
- **LP and Stability Pool sections** replace `RouteLanes`' two cards with Morpho's rhythm: pill label (`Badge`-like, "MUSD/BTC LP" in `accent`, "Stability Pool" in `sp`) → H2 (`headline`: "Earn swap fees" / "Back the system") → paragraph (return source + main risk from `src/lib/routes/copy.ts`, plus the transaction line) → a forward button ("Compare routes" to the simulator section with that route highlighted, or to `#how-it-works`; builder picks, one per section). Illustration on the opposite side, alternating (LP: illustration right; SP: left), stacked below 768 px with text first. Illustrations are inline SVG on the same framed grid with corner `+` marks: the LP one shows a position splitting into ≈half BTC / half MUSD; the SP one shows MUSD deposited with BTC arriving from liquidations. Hovering a section still drives `onHighlight` for the chart.
- **How it works, Trust, Final CTA:** keep content; adopt the same section heading style and new buttons. The final CTA's buttons get the arrow circle.
- Section spacing is uniform (one token, today's `--landing-space-section` may grow to 5–6 rem from 1024 px).

### 7. Typography changes

- `display` and `display-lg` weight becomes 300 (was 700) with letter-spacing ≈ −0.02 em; `typography.test.ts` changes from "700 only in display" to "300 only in display". Inter is loaded as a variable font through `next/font`, so 300 needs no extra download (verify in the build output).
- App page titles (`title`, `headline`) keep weight 600. Only the landing uses `display*` today; confirm with a grep and keep it that way.
- New label style for small uppercase tracked labels (hero figures, section pills): a named class or token, not ad hoc utilities, and allowed by the typography guard.

## What is left to the builder

- Exact file layout of the motion tokens (TS + CSS source of truth), the settle primitive's API, the pending prop's API on `Button`.
- The list of forward buttons that get the arrow circle, and the list of skeleton call sites that get settle-in (both written into the plan).
- Illustration drawings for the LP and SP sections, within the motif rules above.
- Motif geometry details (line count may change for performance; keep it SVG, no canvas, no library).

## Order of work and the deadline cut

Build in this order, each step shippable on its own: (1) motion tokens + guard, (2) Button roll + arrow + press, (3) pending state + StepList, (4) skeleton breathe + settle, (5) hero, (6) landing sections. If time runs short before 25 Oct, stop after any step; steps 1–4 already give the whole app the new feel.

## Verification

- `npm test` (new guard tests: motion tokens, typography weight rule, contrast pair for the arrow circle; existing parity tests unchanged) and `npm run build` (First Load JS of `/` ≤ 97 kB).
- Playwright on the local build: 360/768/1024/1440 px × light/dark: no horizontal scroll; header width at 360 px unchanged; hero motif never overlaps text (bounding-box check); reduced motion shows final states and no running animations (`document.getAnimations()` empty after load); keyboard focus triggers the roll like hover; screen-reader names of buttons are not duplicated (accessibility snapshot); a mock-wallet LP entry with an approval or permit step shows that step's button through wallet → (confirming) → check/Done for ≈1.2 s, then today's finished row, with the live region text unchanged; the final step shows the wallet phase, then the receipt page's heading shows the dot wave and then the check; refetch does not replay the settle.
- Record results in `docs/STATUS.md` (U10 row) and update `AGENTS.md` → Design system with the motion tokens, Button behaviour, pending and loading patterns.
