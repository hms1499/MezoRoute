# U9 Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a light palette that is the default for the whole site, plus a Light/Dark toggle, while dark mode renders exactly as production does today.

**Architecture:** `tokens.ts` holds two palettes with identical keys. A Tailwind `addBase` plugin writes them as CSS variables (light on `:root`, dark on `:root[data-theme="dark"]`), and every Tailwind colour becomes `rgb(var(--color-x) / <alpha-value>)`, so no component class changes. An inline head script sets `data-theme="dark"` before first paint when stored. RainbowKit uses `theme={null}` and one static stylesheet scoped by the same attribute, so the wallet tree never re-renders.

**Tech Stack:** Next 14.2.35 static export, Tailwind 3.4.19, RainbowKit 2.0.2 (`cssStringFromTheme`, `lightTheme`, `darkTheme`), Vitest 5 (node environment, no component tests), Playwright MCP for browser QA.

**Spec:** `docs/superpowers/specs/2026-10-20-u9-light-mode-design.md`

## Global Constraints

- Light is the default for every first visit, whatever `prefers-color-scheme` says. Two states only: `"light" | "dark"`.
- Storage key `mezoroute.theme`; only the value `"dark"` means dark; everything else (missing, garbage, throwing storage) is light. Storage goes through `safeStorage()` (`src/lib/config/network-choice.ts`).
- Dark mode renders exactly as production today, including RainbowKit's own `darkTheme()` modal (background `#1A1B1F`, its borders, backdrop, shadow).
- `WagmiProvider` and `RainbowKitProvider` props never change with the theme; no React context for the theme.
- Light palette (spec table): canvas `#EEF4F2`, surface `#FFFFFF`, well `#F3F7F6`, ink `#0B2523`, muted `#3F5551`, line `#D5E1DE`, accent `#0F766E`, onAccent `#FFFFFF`, sp `#4338CA`, btc `#B03A0B`, danger `#B91C1C`, warning ink `#92400E`, glow `#D3EBE5`. Dark values are today's, unchanged. `*.soft`/`warning.bg` = colour at 12% over that palette's `surface` (`mix`).
- Every text pair, both palettes, ≥ 4.5:1 (`contrast.test.ts`). A light-only failure is fixed with a new semantic token whose dark value equals what dark renders today; never by darkening light `accent` site-wide, never by a class change that alters dark.
- Components never import `palettes` and never write a hex value (the logo's `#fff` marks are the one existing exception).
- No animated colour transition on theme switch. Toggle: header icon button ≥ 640 px (between `NetworkSwitch` and Connect), footer Light | Dark radiogroup below 640 px. No `<meta name="theme-color">` (YAGNI; the spec left it open).
- Repo rules: `cd frontend && npm test && npm run build` before every commit claim; `forge` untouched; conventional commits `feat(frontend):`/`test(frontend):`/`docs:`; check `git status` for iCloud `* 2.*` duplicates before committing.

## Review Focus

1. **Stored dark + reload or network switch (which reloads):** the first paint must already be dark. Pinned in Task 3 (script test) and Task 7 (first-paint screenshot).
2. **Blocked `localStorage` (private window):** the head script and the toggle must not throw; page stays light, toggle still switches for the session. Pinned in Task 3 (`throwing storage` tests).
3. **A connected wallet while toggling:** an OrangeKit (Bitcoin) wallet must stay connected. Pinned by Task 4's static theme (no provider prop change) and checked in Task 7 with the mock wallet across several toggles.
4. **OS in dark mode, first visit:** still light. Task 3 test (`readStoredTheme` ignores the OS; the script only reads storage) and Task 7 with `prefers-color-scheme: dark` emulated.
5. **Viewport crossing 640 px with the page open:** header and footer controls must show the same state. Pinned in Task 6 by one shared store (`subscribeTheme`) that both controls read.

---

## File map

| File | Responsibility |
|---|---|
| `src/lib/ui/tokens.ts` (modify) | `palettes`, CSS-variable `colors` for Tailwind, `themeColor` for TS, `themeVariables()`, `TEXT_PAIRS` for both palettes |
| `src/lib/ui/tokens.test.ts` (create) | palette key parity, variable output, dark values unchanged |
| `tailwind.config.ts` (modify) | read `colors`, add the `addBase` plugin with `themeVariables()`, `night-glow` from variables |
| `src/app/globals.css` (modify) | `theme("colors…")` and raw `rgba(45, 212, 191, …)` → variables; `color-scheme` per theme |
| `src/lib/ui/theme.ts` (create) | theme state: read, apply, subscribe, head script string |
| `src/app/layout.tsx` (modify) | head script, `suppressHydrationWarning` |
| `src/lib/wallet/rainbow-theme.ts` (create) | the static RainbowKit stylesheet for both themes |
| `src/app/providers.tsx` (modify) | `theme={null}`, inject the stylesheet, avatar via `themeColor` |
| `src/components/chart/BtcMoveChart.tsx` (modify) | colours via `themeColor` in `style` |
| `src/components/ThemeToggle.tsx` (create) | `ThemeToggle` (header) and `ThemeSwitch` (footer) |
| `src/components/Header.tsx`, `Footer.tsx`, `ui/Button.tsx`, `NetworkSwitch.tsx`, `lp/AmountInput.tsx`, others from the audit (modify) | toggle placement, `quiet` button variant, new semantic tokens |
| `src/lib/ui/palette-guard.test.ts` (modify) | forbid `palettes` imports and hex literals in components/app |
| `AGENTS.md`, `docs/STATUS.md`, `src/components/AppShell.tsx` comment | docs |

---

### Task 1: Two palettes as CSS variables

**Files:**
- Modify: `frontend/src/lib/ui/tokens.ts`, `frontend/tailwind.config.ts`, `frontend/src/app/globals.css`
- Create: `frontend/src/lib/ui/tokens.test.ts`
- Test: `frontend/src/lib/ui/contrast.test.ts` (unchanged code; `TEXT_PAIRS` grows)

**Interfaces:**
- Produces (in `tokens.ts`):
  - `type Theme = "light" | "dark"` (exported here; `theme.ts` re-exports it).
  - `type Palette` with keys `canvas, surface, well, ink, muted, line, accent, onAccent, sp, btc, danger, warning, glow` (hex strings). Task 5 adds keys.
  - `palettes: Record<Theme, Palette>`.
  - `COLOR_VARS: Record<string, (p: Palette) => string>`: flat variable name (without `--color-`) → hex for a palette. Names: `canvas, surface, well, ink, muted, line, accent, accent-soft, on-accent, sp, sp-soft, btc, btc-soft, danger, danger-soft, warning-ink, warning-bg, glow`.
  - `themeVariables(): Record<string, Record<string, string>>` → `{ ":root": { "--color-<name>": "R G B", …, "color-scheme": "light" }, ':root[data-theme="dark"]': { …dark…, "color-scheme": "dark" } }`.
  - `colors`: same shape as today (`canvas`, `accent.DEFAULT`, `accent.soft`, `onAccent`, `warning.bg`/`.ink`, `night.*`…) but each value is `rgb(var(--color-<name>) / <alpha-value>)`.
  - `themeColor: Record<name, string>`: `rgb(var(--color-<name>))` per `COLOR_VARS` name, for TypeScript consumers (Task 2).
  - `textPairs(p: Palette): [name, fg, bg][]` (today's list, computed from a palette) and `TEXT_PAIRS` = `light: …` + `dark: …` entries.

- [ ] **Step 1: Write the failing tests** in `tokens.test.ts`:
  - `"light and dark palettes have the same keys"`: `Object.keys(palettes.light).sort()` equals dark's.
  - `"dark palette is today's production palette"`: `palettes.dark` equals `{ canvas: "#0A1416", surface: "#162022", well: "#0F1A1C", ink: "#E8F1EF", muted: "#9FB3AF", line: "#222B2D", accent: "#2DD4BF", onAccent: "#062221", sp: "#A5B4FC", btc: "#FB923C", danger: "#F87171", warning: "#FCD34D", glow: "#123B3A" }` (with `toMatchObject`, so Task 5 keys may be added).
  - `"light palette is the spec's table"`: same with the light values from Global Constraints.
  - `"themeVariables writes light on :root and dark under data-theme"`: `themeVariables()[":root"]["--color-accent"]` is `"15 118 110"`, `[':root[data-theme="dark"]']["--color-accent"]` is `"45 212 191"`, `["--color-accent-soft"]` in dark is the triplet of `mix("#2DD4BF", "#162022", 0.12)`, and `color-scheme` is `light`/`dark`.
  - `"Tailwind colours are variable references"`: `colors.accent.DEFAULT === "rgb(var(--color-accent) / <alpha-value>)"`, `colors.night.lp === colors.accent.DEFAULT`.
  - `"TEXT_PAIRS covers both palettes"`: names start with `light: ` and `dark: `, equal counts.

- [ ] **Step 2: Run** `cd frontend && npx vitest run src/lib/ui/tokens.test.ts` — Expected: FAIL (`palettes` not exported).

- [ ] **Step 3: Implement in `tokens.ts`.** Keep `mix` derivations; `soft` takes the palette's surface. Keep the U3 comment updated (two palettes, same roles). `fontSize`, `CHART_FONT_PX`, `NIGHT_DIM_OPACITY` unchanged.

- [ ] **Step 4: Wire Tailwind and CSS.**
  - `tailwind.config.ts`: `plugins: [plugin(({ addBase }) => addBase(themeVariables()))]` (`tailwindcss/plugin`); `night-glow` becomes `radial-gradient(1100px 520px at 25% -5%, rgb(var(--color-glow)) 0%, rgb(var(--color-canvas)) 62%)`. Update the header comment.
  - `globals.css`: remove `color-scheme: dark` from `html` (the plugin sets it); replace every `theme("colors.X")` with `rgb(var(--color-X))` (13 uses; `color-mix(in srgb, rgb(var(--color-surface)) 68%, transparent)` for the chart surface); `landing-ping` → `rgb(var(--color-accent) / 0.6)` and `/ 0`; `landing-flash` → `rgb(var(--color-accent) / 0.18)`.

- [ ] **Step 5: Run** `npx vitest run src/lib/ui` — Expected: PASS, including every `light: …` pair in `contrast.test.ts`. If a light pair fails, nudge that light value within its hue and update the spec table in the same commit.

- [ ] **Step 6: Build and check output.** `npm run build` passes; `grep -o 'data-theme=\\\\"dark\\\\"\]{[^}]*' out/_next/static/css/*.css | head -c 300` shows dark variables, and `grep -c 'theme(' out/_next/static/css/*.css` is 0.

- [ ] **Step 7: Commit** `feat(frontend): light and dark palettes as CSS variables` (tokens.ts, tokens.test.ts, tailwind.config.ts, globals.css).

### Task 2: TypeScript colour consumers follow the theme

**Files:**
- Modify: `frontend/src/components/chart/BtcMoveChart.tsx`, `frontend/src/app/providers.tsx` (avatar only), `frontend/src/lib/ui/palette-guard.test.ts`

**Interfaces:**
- Consumes: `themeColor` (Task 1).

- [ ] **Step 1: Extend the guard (failing test).** In `palette-guard.test.ts` add `"never imports raw palettes in components"` (no `palettes` identifier imported from `@/lib/ui/tokens` in `components/` or `app/`) and `"writes no hex colours in components"` (`/#[0-9A-Fa-f]{3,8}\b/` in `.tsx` under `components/` and `app/`, allow-list `components/ui/Logo.tsx`), and `"uses no colours.* hex tokens in components"`: no `colors.` member access in `.tsx` (consumers use `themeColor`).

- [ ] **Step 2: Run** `npx vitest run src/lib/ui/palette-guard.test.ts` — Expected: FAIL on `BtcMoveChart.tsx` and `providers.tsx` (`colors.`).

- [ ] **Step 3: Migrate.** `BtcMoveChart`: `STROKE`, `BAND_FILL`, `BAND_TEXT`, `halo`, grid/today/axis/crossing colours from `themeColor` (`accent`, `sp`, `ink`, `danger-soft`, `warning-bg`, `danger`, `warning-ink`, `line`, `muted`, `surface`, `well`), passed through `style={{ stroke, fill }}` instead of presentation attributes (presentation attributes don't reliably resolve `var()`). Keep `fontSize={CHART_FONT_PX}` as is (the typography guard). `WalletAvatar` style uses `themeColor["accent-soft"]` and `themeColor.accent`.

- [ ] **Step 4: Run** `npm test` — Expected: PASS (all suites).

- [ ] **Step 5: Commit** `feat(frontend): chart and wallet avatar read theme variables`.

### Task 3: Theme state and the no-flash head script

**Files:**
- Create: `frontend/src/lib/ui/theme.ts`, `frontend/src/lib/ui/theme.test.ts`
- Modify: `frontend/src/app/layout.tsx`

**Interfaces:**
- Consumes: `Theme` (Task 1), `safeStorage`, `StorageLike` (`network-choice.ts`).
- Produces:
  - `THEME_STORAGE_KEY = "mezoroute.theme"`, `DARK_THEME = "dark"`.
  - `readStoredTheme(storage: Pick<Storage, "getItem">): Theme`.
  - `currentTheme(root: { dataset: DOMStringMap }): Theme` — `"dark"` iff `root.dataset.theme === "dark"`.
  - `applyTheme(theme: Theme, root = document.documentElement, storage: StorageLike = safeStorage()): void` — dark sets `data-theme="dark"`, light removes the attribute; stores the value; then notifies subscribers.
  - `subscribeTheme(listener: () => void): () => void` — module-level listener set used by Task 6 with `useSyncExternalStore`.
  - `THEME_INIT_SCRIPT: string` — built from the two constants, wrapped in `try {…} catch {}`: if `localStorage.getItem(KEY) === "dark"` set `document.documentElement.dataset.theme = "dark"`.

- [ ] **Step 1: Write failing tests** (reuse the `memoryStorage`/`securityError` helpers pattern from `network-choice.test.ts`):
  - `readStoredTheme`: missing → `"light"`; `"dark"` → `"dark"`; `"light"`, `"Dark"`, `""`, `"system"` → `"light"`.
  - `applyTheme("dark", root, storage)`: `root.dataset.theme === "dark"`, storage holds `"dark"`; then `applyTheme("light", …)`: attribute gone (`!("theme" in root.dataset)`), storage holds `"light"`; a subscriber registered with `subscribeTheme` was called twice and not after unsubscribing.
  - `applyTheme` with `safeStorage(() => securityError())` does not throw and still sets the attribute.
  - `THEME_INIT_SCRIPT`: run with `new Function("document", "localStorage", THEME_INIT_SCRIPT)` against a fake `{ documentElement: { dataset: {} } }`: stored `"dark"` → dataset `theme` is `"dark"`; stored nothing → no `theme`; a `localStorage` whose `getItem` throws → no throw, no `theme`. Also `expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY)`.

- [ ] **Step 2: Run** `npx vitest run src/lib/ui/theme.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `theme.ts`.**

- [ ] **Step 4: Wire `layout.tsx`.** `<html … suppressHydrationWarning>`, and `<head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>` before `<body>`. One comment: why it runs before paint and why light needs nothing.

- [ ] **Step 5: Run** `npm test && npm run build` — Expected: PASS; `grep -c 'mezoroute.theme' out/index.html` ≥ 1.

- [ ] **Step 6: Commit** `feat(frontend): theme state and no-flash head script`.

### Task 4: RainbowKit themes scoped by `data-theme`

**Files:**
- Create: `frontend/src/lib/wallet/rainbow-theme.ts`, `frontend/src/lib/wallet/rainbow-theme.test.ts`
- Modify: `frontend/src/app/providers.tsx`

**Interfaces:**
- Consumes: `palettes` (allowed here: `lib/`, not a component).
- Produces: `darkRainbowTheme: Theme` (RainbowKit's), `lightRainbowTheme: Theme`, `RAINBOW_THEME_CSS: string` = `[data-rk]{${cssStringFromTheme(lightRainbowTheme)}}html[data-theme="dark"] [data-rk]{${cssStringFromTheme(darkRainbowTheme, { extends: lightRainbowTheme })}}`.

- [ ] **Step 1: Write failing tests:**
  - `"dark theme is today's production theme"`: `darkRainbowTheme` deep-equals `{ ...darkTheme({ accentColor: "#2DD4BF", accentColorForeground: "#062221", borderRadius: "large" }), fonts: { body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" } }` (literal hex on purpose: this is what production renders).
  - `"light theme uses the light palette"`: `lightRainbowTheme.colors.accentColor === palettes.light.accent`, `.accentColorForeground === palettes.light.onAccent`, `.modalBackground === palettes.light.surface`, `.modalText === palettes.light.ink`, `.modalTextSecondary === palettes.light.muted`, `.modalBorder === palettes.light.line`; `radii` equal `lightTheme({ borderRadius: "large" }).radii`; `shadows` equal `lightTheme().shadows` (keeps RainbowKit's dialog shadow).
  - `"stylesheet scopes dark under data-theme"`: `RAINBOW_THEME_CSS` starts with `[data-rk]{` and contains `html[data-theme="dark"] [data-rk]{`.
  If importing `@rainbow-me/rainbowkit` fails under Vitest's node environment, add `// @vitest-environment jsdom` only if `jsdom` is already installed; otherwise stop and report (do not add dependencies).

- [ ] **Step 2: Run** `npx vitest run src/lib/wallet/rainbow-theme.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `rainbow-theme.ts`;** fill the light theme's other modal-visible colour keys (`generalBorder`, `actionButtonSecondaryBackground`, `closeButton`, `closeButtonBackground`, `menuItemBackground`, `profileForeground`, `selectedOptionBorder`, `modalBackdrop`) from the light palette where `lightTheme()`'s value would clash, decided by looking at the modal in Task 7.

- [ ] **Step 4: Wire `providers.tsx`.** Delete `baseTheme`/`theme`; `RainbowKitProvider theme={null}`; render `<style dangerouslySetInnerHTML={{ __html: RAINBOW_THEME_CSS }} />` once inside `WalletTree` before `WagmiProvider`. Update the comment (dark modal unchanged on purpose).

- [ ] **Step 5: Run** `npm test && npm run build` — Expected: PASS.

- [ ] **Step 6: Commit** `feat(frontend): RainbowKit light and dark themes scoped by data-theme`.

### Task 5: Contrast audit and light-only tokens

**Files:**
- Modify: `frontend/src/lib/ui/tokens.ts`, `frontend/src/lib/ui/tokens.test.ts`, `frontend/src/components/NetworkSwitch.tsx`, `frontend/src/components/ui/Button.tsx`, `frontend/src/components/lp/AmountInput.tsx`, and any file the audit finds.

**Interfaces:**
- Produces: palette keys `selected` and `accentTint`; Tailwind colours `selected` (`bg-selected`) and `accent-tint` (`bg-accent-tint`); `COLOR_VARS` gains `selected` (triplet) — `accentTint` is a full colour value, not a triplet, so dark keeps today's translucency (`--color-accent-tint: rgb(45 212 191 / 0.1)`; Tailwind value `var(--color-accent-tint)`).
  - `selected`: dark `#222B2D` (= dark `line`, what `bg-line` renders today), light `#E2EFEE` (accent-soft; accent on it 4.64:1).
  - `accentTint`: dark `rgb(45 212 191 / 0.1)` (= today's `bg-accent/10`), light `rgb(15 118 110 / 0.04)` (accent over it ≥ 4.67:1 on canvas, 5.19:1 on surface).

- [ ] **Step 1: Audit.** List every coloured text on a tinted or coloured background: `grep -rnE "bg-line|bg-[a-z-]+/[0-9]+|hover:bg-|active:bg-|-soft|bg-well|bg-warning" src/components --include=*.tsx` (today ≈ 31 sites: AppShell, MainnetBanner, NetworkSwitch, ExposurePanel, RouteComparison ×2, Simulator, AmountInput ×2, ConfirmSummary, EntryPreviewCard, ModeToggle ×2, Badge ×5, Button ×5, Notice ×3, PageHeader, StepList, Term, BtcMoveChart). For each, note the text colour and the effective background (flatten translucent ones over the surface they sit on). Write the list into the commit message body.

- [ ] **Step 2: Failing tests.** Add every audited pair not yet in `textPairs` (e.g. `accent on line (selected network)`, `accent on accent/10 over canvas (outline hover)`, `ink on line (selected mode)`), computing translucent backgrounds with `mix`. In `tokens.test.ts` add `"light-only tokens keep dark output"`: `palettes.dark.selected === palettes.dark.line` and the dark `--color-accent-tint` equals `rgb(45 212 191 / 0.1)`. Run `npx vitest run src/lib/ui` — Expected: FAIL on the light pairs (4.08, 4.30) and the missing keys.

- [ ] **Step 3: Implement** the two tokens and point `textPairs` at them for those pairs; switch `NetworkSwitch` active option `bg-line` → `bg-selected`, `Button` `nightOutline` and `AmountInput` Max `hover:bg-accent/10` → `hover:bg-accent-tint`. Any other light-only failure from the audit gets the same treatment (new token, dark value = today's).

- [ ] **Step 4: Run** `npm test && npm run build` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(frontend): contrast audit, selected and accent-tint tokens`.

### Task 6: The toggle

**Files:**
- Create: `frontend/src/components/ThemeToggle.tsx`
- Modify: `frontend/src/components/Header.tsx`, `frontend/src/components/Footer.tsx`, `frontend/src/components/ui/Button.tsx`

**Interfaces:**
- Consumes: `applyTheme`, `currentTheme`, `subscribeTheme` (Task 3).
- Produces: `useTheme(): Theme` (in `ThemeToggle.tsx`, via `useSyncExternalStore(subscribeTheme, () => currentTheme(document.documentElement), () => "light")`), `ThemeToggle` (header), `ThemeSwitch` (footer); `ButtonVariant` gains `"quiet"` = `` `${OUTLINE} text-muted ring-line hover:text-ink` ``.

- [ ] **Step 1: `ThemeToggle`:** `<Button size="sm" variant="quiet" className="hidden w-9 px-0 sm:inline-flex">` with `Moon` (light) / `Sun` (dark) from `lucide-react`, `aria-hidden`, `h-4 w-4`; `aria-label` "Switch to dark mode" / "Switch to light mode"; click → `applyTheme(other)`.
- [ ] **Step 2: `ThemeSwitch`:** same markup and classes as `NetworkSwitch` (`role="radiogroup"`, `aria-label="Theme"`, options "Light" / "Dark", active option `bg-selected text-accent font-semibold`), wrapped in `sm:hidden`; selecting the active one does nothing.
- [ ] **Step 3: Place them.** Header: `<ThemeToggle />` between `<NetworkSwitch />` and `ConnectButton.Custom`. Footer: `<ThemeSwitch />` in the top block below the project links (below 640 px the block is a column, so it sits last, left-aligned).
- [ ] **Step 4: Run** `npm test && npm run build` — Expected: PASS (typography and palette guards included).
- [ ] **Step 5: Quick browser check** on the local export (`npx serve out -l 4180` or the repo's usual static server): at 360 px the header still spans 16–344 px with no wrap (`document.documentElement.scrollWidth === 360`) and the footer shows the switch; at 640 px and up the header shows the icon and the footer does not. Click toggles; attribute and `localStorage['mezoroute.theme']` follow; resizing across 640 px shows the same state in both controls.
- [ ] **Step 6: Commit** `feat(frontend): light/dark toggle in the header and footer`.

### Task 7: Browser QA in both themes, docs

**Files:**
- Modify: `AGENTS.md` (Frontend → design-system paragraph), `docs/STATUS.md`, `frontend/src/components/AppShell.tsx` (the "One dark palette everywhere" comment)

- [ ] **Step 1: Serve** `frontend/out` locally and drive it with Playwright and the keyless mock EIP-1193 wallet on a QA account with a Trove (`docs/STATUS.md` → QA accounts).
- [ ] **Step 2: Matrix, both themes, 360/768/1024/1440 px:** landing (hero glow, hero chart, simulator, live strip, route lanes, trust row, how it works, final CTA), dashboard (cards, "If BTC moves", Compare routes incl. mobile tabs), LP route → confirm, receipt, positions, LP exit, SP route/withdraw, RainbowKit connect and account modals, a `Term` popover, an error toast (cancel in the mock wallet), skeletons while loading. For each: viewport screenshot (not full-page, AGENTS), `scrollWidth` equals the viewport, no element still using dark colours in light (spot-check computed `background-color` of `body`, a `.card`, the header).
- [ ] **Step 3: Dark is unchanged:** screenshot the landing and dashboard at 1440 px in dark, compare against `https://mezoroute.vercel.app` at the same size (production is dark today); differences beyond live data are bugs. The RainbowKit modal in dark matches production.
- [ ] **Step 4: Behaviour:** with empty storage and `prefers-color-scheme: dark` emulated, first visit is light; with `mezoroute.theme=dark` stored, a screenshot taken at first paint (`page.goto` with `waitUntil: "commit"` then immediate screenshot) is dark; Testnet ↔ Mainnet switch keeps the theme; toggle by keyboard (Tab, Enter/Space; radiogroup arrows in the footer if `NetworkSwitch` supports them, else Tab); reduced motion; toggling 5× with the mock wallet connected keeps it connected; 0 console errors.
- [ ] **Step 5: Fix** anything found (each fix with its test where one fits), re-run `npm test && npm run build`.
- [ ] **Step 6: Docs.** `AGENTS.md`: replace "Since U3 there is one dark palette for the landing and the app" with the two-palette rule (tokens → CSS variables written by the Tailwind plugin, light default, `data-theme="dark"` set by the head script from `mezoroute.theme`, RainbowKit via `RAINBOW_THEME_CSS` with `theme={null}`, light-only fixes as new semantic tokens, components never import `palettes` or write hex), and add the spec path. `STATUS.md`: U9 row, test count, session log line. AppShell comment.
- [ ] **Step 7: Commit** `docs: U9 light mode in AGENTS and STATUS` (plus any `fix(frontend):` commits from Step 5).
