# U9 — Light mode

**Date:** 20 Oct 2026 · **Branch:** `feat/u9-light-mode` · **Status:** draft for user review

## Why

Since U3 the landing and the app share one dark palette. The user wants a light mode as an extra choice for people using the app. The dark mode is not a problem and stays exactly as it is today.

## Goals

1. A light palette for the whole site (landing and app), with the same roles as the dark one: teal for actions and the LP route, lavender for the Stability Pool, orange for BTC exposure only.
2. **Light is the default** for every first visit, whatever the OS setting (user's decision).
3. A visible toggle switches between Light and Dark instantly (no reload). The choice is remembered.
4. No flash of the wrong theme on load, on reload, or when switching networks (which reloads the page).
5. Every text/background pair in **both** palettes reaches WCAG AA (4.5:1), checked by `contrast.test.ts`.

## Non-goals

- No "follow the system" option: two states only, Light and Dark (agent's call: the user wants light on first visit regardless of the OS, and a third state would only matter to people who never touch the toggle).
- No change to layout, type scale, copy, flows, or transactions.
- Wallets' own popups (MetaMask, Unisat, OKX, Xverse…) draw themselves and are not themed.
- Screenshots already in the README, deck, and video stay dark; no need to redo them.

## Anti-goals (a failure even if the build passes)

- The wallet disconnects, or a Bitcoin (OrangeKit) wallet logs out, when the theme changes. `WagmiProvider` must never re-render because of the theme (AGENTS.md → Frontend).
- The page flashes dark → light or light → dark on load.
- Any text pair below 4.5:1 in either palette, or any colour that ignores the theme (stays dark-mode teal on a light page, for example).
- The 360 px header gains horizontal scroll or wraps.
- The dark mode looks any different from today's production.

## Light palette (decided: direction A, picked in the brainstorm companion)

Light canvas tinted towards mint, white panels lifted by contrast alone (still no shadows), a soft teal glow behind the hero, ink in a very dark teal of the same family as the dark palette. Accents are deeper versions of the dark ones so text passes on light backgrounds.

| Token | Dark (unchanged) | Light |
|---|---|---|
| `canvas` | `#0A1416` | `#EEF4F2` |
| `surface` | `#162022` | `#FFFFFF` |
| `well` | `#0F1A1C` | `#F3F7F6` |
| `ink` | `#E8F1EF` | `#0B2523` |
| `muted` | `#9FB3AF` | `#3F5551` |
| `line` | `#222B2D` | `#D5E1DE` |
| `accent` | `#2DD4BF` | `#0F766E` |
| `onAccent` | `#062221` | `#FFFFFF` |
| `sp` | `#A5B4FC` | `#4338CA` |
| `btc` | `#FB923C` | `#B03A0B` |
| `danger` | `#F87171` | `#B91C1C` |
| `warning` (ink) | `#FCD34D` | `#92400E` |
| `glow` (landing) | `#123B3A` | `#D3EBE5` |

`*.soft` and `warning.bg` stay derived as today: the colour at 12% over that palette's `surface`, flattened. Checked by hand against every pair `TEXT_PAIRS` lists today (including `muted on line`, the 80% dimmed simulator text, `canvas on danger`, `onAccent on accent`): the lowest is accent on accent-soft at 4.64:1. The builder may nudge a value if a pair fails once the test runs, but must stay within the same hue and keep each role's meaning.

**Pairs `TEXT_PAIRS` does not list yet (agent's call, from the builder check).** Some components put coloured text on a tinted background that the test never sees, and two of them fail in light with the values above: the active Testnet/Mainnet option (`text-accent` on `bg-line`, 4.08:1) and `nightOutline`/Max hover (`text-accent` on `accent/10` over `canvas`, 4.30:1). So:

1. Audit task: list every coloured-text-on-tinted-background pair the components render (`bg-line`, `bg-*/N`, `*-soft`, `hover:`/`active:` states) and add each to `TEXT_PAIRS`, which runs for both palettes.
2. A pair that fails only in light is fixed with a **new semantic token** whose dark value equals what dark renders today (for example `selected` = `line` in dark, a lighter value in light; or a `hoverTint`). Components switch to the new token. Dark output stays identical to the pixel; a test checks each new token's dark value against the value it replaces.
3. Not allowed: darkening the light `accent` for the whole site (it would need ≈ `#0D6B63`, beyond a nudge), or class changes that alter what dark renders.

## How it works (decided)

### Tokens → CSS variables

- `src/lib/ui/tokens.ts` keeps one source: two palettes with identical keys (`palettes.light`, `palettes.dark`; a test checks the keys match).
- Tailwind's `colors` become CSS-variable references in the `rgb(var(--color-x) / <alpha-value>)` form, so every existing class (`bg-surface`, `text-accent`, `bg-accent/10`, `border-line/60`…) keeps working unchanged in both themes.
- The variables are written by `tailwind.config.ts` itself (a small `addBase` plugin reading `palettes`): light on `:root`, dark on `:root[data-theme="dark"]`. CSS never repeats a hex value that `tokens.ts` holds.
- `color-scheme` follows the theme (`light` on `:root`, `dark` under `[data-theme="dark"]`), so native controls and scrollbars match.
- The raw `rgba(45, 212, 191, …)` values in the `landing-ping` and `landing-flash` keyframes and the `night-glow` background image switch to the variables.
- `night.*` aliases stay, now pointing at the same variables.

### Colours used from TypeScript

Two modules read hex values today: `components/chart/BtcMoveChart.tsx` and `app/providers.tsx` (wallet avatar, RainbowKit theme). They switch to CSS-variable values (for example a `themeColor.accent` that is `rgb(var(--color-accent))`), so they follow the theme without React re-rendering. SVG presentation attributes do not reliably resolve `var()`; the chart sets these colours through `style` or Tailwind classes (`fill-accent`, `stroke-line`). Components never import the raw `palettes` (only `tokens.ts`, the Tailwind config, and the tests do).

### RainbowKit

Today's dark modal is RainbowKit's own `darkTheme()` with only the accent, radius, and font overridden (background `#1A1B1F`, white text, its own borders, backdrop, and shadow), not the app's palette. **Dark mode keeps that modal exactly** (agent's call: the user said dark mode stays as it is).

- Use RainbowKit's documented selector-scoped theming: `RainbowKitProvider theme={null}`, plus one static `<style>` built with `cssStringFromTheme`: the light theme on `[data-rk]`, today's dark theme (`darkTheme({ accentColor, accentColorForeground, borderRadius: "large" })` with the Inter font, exactly as `providers.tsx` builds it now) under `html[data-theme="dark"] [data-rk]`. Both are built once at module level, so the provider props never change and the wallet tree never re-renders.
- The light theme starts from `lightTheme()` with the light accent/onAccent, radius, and font, and its modal colours mapped to the light palette (modal background `surface`, text `ink`, secondary text `muted`, borders `line`). It keeps RainbowKit's own modal shadow, as dark does today: the no-shadow rule is for the app's panels, not the library's dialog.
- A test checks the dark CSS string equals what today's `darkTheme(…)` call produces.
- The wallet avatar (`WalletAvatar`) switches to the CSS variables like the chart.
- The builder checks the connect and account modals in both themes.

### Theme state

- `src/lib/ui/theme.ts`: `Theme = "light" | "dark"`, storage key `mezoroute.theme` (no network prefix: it is one choice for the whole site), `readStoredTheme(storage)` (anything other than `"dark"` is light), `applyTheme(theme)` (sets or removes `data-theme` on `<html>` and stores the choice). Storage goes through the existing `safeStorage()`, so a blocked `localStorage` falls back to light without throwing.
- No React context: colours come from CSS. Only the toggle needs the current value; it reads it from `<html>` after mount.

### No flash

`layout.tsx` puts a short inline script in `<head>` that reads `mezoroute.theme` and sets `data-theme="dark"` before the body paints (inside `try/catch`). Light needs nothing, so with JavaScript off or storage blocked the page is light. `<html>` gets `suppressHydrationWarning` because the attribute is set before React hydrates.

### The toggle

- From 640 px up: an icon button in the header, between the network switch and the Connect/account button: `Moon` in light mode, `Sun` in dark (lucide, `aria-hidden`), size matching the `sm` buttons, the same inset-ring outline the header already uses. Accessible name says what it does: "Switch to dark mode" / "Switch to light mode".
- Below 640 px the header has no room (measured on production at 360 px: logo, the one nav link, Testnet/Mainnet, and Connect fill 16–344 px with no slack). The toggle sits in the footer instead, as a small Light | Dark segmented control in the style of the network switch (`role="radiogroup"`, label "Theme"), shown below 640 px only.
- Switching is instant and has no animated colour transition across the page.

## Everything that must follow the theme

Landing (hero glow, hero chart, simulator, live strip, route lanes, trust row, how it works, final CTA glow panel), header and footer, Mainnet banner, dashboard cards and the "If BTC moves" chart, Compare routes (including the mobile tabs), route/confirm/receipt/exit/withdraw pages and `MobileBar`, positions, `Term` popovers, error toast, `Notice`, `Badge`, `Skeleton` shimmer, focus outline, the RainbowKit connect and account modals, and the logo (white marks on teal pass in both).

## Tests and QA

- `contrast.test.ts` runs `TEXT_PAIRS` for both palettes (names say which palette).
- Unit tests for `theme.ts`: stored value parsing (missing, `"dark"`, garbage, throwing storage), `applyTheme` sets/removes the attribute and stores.
- A test that the head script and `theme.ts` agree on the key and the dark value (one shared constant, or the script built from it).
- Existing guards (`palette-guard`, `typography`) keep passing.
- `npm test && npm run build` in `frontend/`.
- Playwright on the local build, both themes, at 360/768/1024/1440 px: landing, dashboard (with a mock-wallet QA account that has a Trove), LP route → confirm, receipt, positions, LP exit, SP route/withdraw, the RainbowKit modals, a `Term` popover, an error toast. Check: no horizontal scroll, no wrong-theme colours, reload and network switch keep the theme with no flash (screenshot the first paint with `mezoroute.theme=dark` stored), first visit with empty storage is light even with `prefers-color-scheme: dark` emulated, the toggle works by keyboard, reduced motion, 0 console errors, a connected wallet stays connected across toggles.

## Docs

`AGENTS.md` → Frontend design-system paragraph: replace "one dark palette" with the two-palette rule (tokens as CSS variables, light default, `data-theme="dark"`, never a raw hex or `palettes` import in components). Add U9 to `docs/STATUS.md`.

## Left to the builder

- Variable naming (`--color-*` or similar) and whether channels are stored as `R G B` triplets.
- The exact RainbowKit theme keys and overlay value.
- Whether to add a `<meta name="theme-color">` that the head script and the toggle update.
- How the footer control sits in the footer layout below 640 px.
