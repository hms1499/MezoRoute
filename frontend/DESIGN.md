---
version: "1.0"
name: MezoRoute
description: "One design system for MezoRoute: a calm, high-trust dapp for routing MUSD on Mezo. Two themes, Geist Mono, teal for actions."
colors:
  light:
    canvas: "#EEF4F2"
    surface: "#FFFFFF"
    well: "#F3F7F6"
    ink: "#0B2523"
    muted: "#3F5551"
    line: "#D5E1DE"
    accent: "#0F766E"
    onAccent: "#FFFFFF"
    sp: "#4338CA"
    btc: "#B03A0B"
    danger: "#B91C1C"
    warning: "#92400E"
    positive: "#15803D"
    negative: "#B91C1C"
    glow: "#D3EBE5"
    selected: "#E2EFEE"
    accentTint: 0.04
    accentHover:
      hex: "#0D6B63"
      alpha: 1
    accentPressed:
      hex: "#0B5F58"
      alpha: 1
  dark:
    canvas: "#0A1416"
    surface: "#162022"
    well: "#0F1A1C"
    ink: "#E8F1EF"
    muted: "#9FB3AF"
    line: "#222B2D"
    accent: "#2DD4BF"
    onAccent: "#062221"
    sp: "#A5B4FC"
    btc: "#FB923C"
    danger: "#F87171"
    warning: "#FCD34D"
    positive: "#4ADE80"
    negative: "#F87171"
    glow: "#123B3A"
    selected: "#222B2D"
    accentTint: 0.1
    accentHover:
      hex: "#2DD4BF"
      alpha: 0.9
    accentPressed:
      hex: "#2DD4BF"
      alpha: 0.8
typography:
  family: Geist Mono
  scale:
    xs:
      - 12px
      - lineHeight: 16px
    sm:
      - 14px
      - lineHeight: 20px
    base:
      - 16px
      - lineHeight: 24px
    xl:
      - 20px
      - lineHeight: 28px
    headline:
      - 24px
      - lineHeight: 32px
        fontWeight: "600"
        letterSpacing: -0.025em
    title:
      - 28px
      - lineHeight: 34px
        fontWeight: "600"
        letterSpacing: -0.025em
    figure:
      - 28px
      - lineHeight: 32px
        fontWeight: "500"
        letterSpacing: -0.025em
    display:
      - 40px
      - lineHeight: 48px
        fontWeight: "300"
        letterSpacing: -0.02em
    display-lg:
      - 48px
      - lineHeight: 52px
        fontWeight: "300"
        letterSpacing: -0.02em
  roles:
    pageTitle: text-title
    landingSection: text-headline
    cardTitle: text-base font-semibold
    keyFigure: text-figure
    figure: text-xl font-medium
    body: text-sm
    label: text-sm font-medium
    caption: text-xs
rounded:
  none: 0px
  tip: 8px
  inset: 12px
  card: 16px
  pill: 9999px
  full: 9999px
spacing:
  unit: 4px
  steps:
    - 0
    - 0.5
    - 1
    - 2
    - 3
    - 4
    - 5
    - 6
    - 8
    - 10
    - 12
    - 16
    - 20
    - 24
controls:
  lg:
    h: 44
    px: 20
    text: sm
  md:
    h: 36
    px: 16
    text: sm
  sm:
    h: 28
    px: 12
    text: xs
  icon:
    h: 36
    w: 36
icons:
  ui:
    - 14
    - 16
    - 20
  token:
    - 16
    - 20
    - 24
  indicator: 24
  logo:
    header: 28
    footer: 24
elevation:
  none: none
  overlay: 0 12px 32px -12px rgb(0 0 0 / 0.28)
motion:
  ease:
    smooth:
      - 0.36
      - 0.2
      - 0.07
      - 1
    swift:
      - 0.2
      - 0
      - 0
      - 1
  ms:
    fast: 200
    base: 400
    slow: 600
---

# MezoRoute Design System

The one design system for MezoRoute's app and landing. The YAML above is the token set; `src/lib/ui/design-doc.test.ts` fails the build when it differs from `src/lib/ui/tokens.ts` and `src/lib/ui/motion.ts`, so this file and the code never drift. Every rule below also has a guard test (listed under Agent Guidelines).

## Overview

**Atmosphere.** A calm, precise dapp, in the family of Aave and Aerodrome: compact cards, a token chip in every amount field, figures in columns, one clear action per view. It should feel stable when BTC is not.

**Density.** Medium-high. Figures, positions, and actions come first; explanations sit one click away ("Details", `Term` popovers) but never disappear before a signature.

**Personality.** Plain words, no hype. Rates are always "this week's"; nothing is "guaranteed"; the Stability Pool is never annualised.

**Principles.**
- One font, Geist Mono, so every figure lines up without special classes.
- Colour is semantic and scarce: teal for actions and the LP route, lavender for the Stability Pool, orange only for BTC exposure, green and red only for signed results.
- Hierarchy comes from size and weight, never from colour alone.
- One primary (filled) button per view.

## Colors

Two palettes with the same keys (`colors.light`, `colors.dark`). Light is the default for every first visit; the theme lives in `localStorage` (`mezoroute.theme`). Components only use Tailwind colour classes (`bg-surface`, `text-muted`…) that resolve CSS variables; no component writes a hex (`palette-guard.test.ts`). Every text pair in both palettes reaches 4.5:1 (`contrast.test.ts`).

### Surfaces
- **canvas**: the page.
- **surface**: cards and panels, with a 1 px `line` border.
- **well**: insets inside a card (amount fields, overview boxes, chart areas, neutral notices).
- **Overlay**: popovers, menus, toasts: `surface` plus `shadow-overlay`.

### Text
- **ink**: content, headings, figures.
- **muted**: labels, captions, secondary lines.

### Roles
- **accent** (teal): actions, the LP route, focus rings, selected toggles. Never a large background.
- **sp** (lavender): the Stability Pool.
- **btc** (orange): BTC exposure only.
- **positive / negative**: signed financial results only (a 30-day result), always with a `+` or `−` sign. `positive` stays visibly apart from `accent`; `negative` shares `danger`'s hue.
- **danger**: errors and destructive actions only. **warning**: risk and caution.
- **selected, accentTint, accentHover, accentPressed**: state colours tuned per theme so their text passes.

## Typography

Geist Mono everywhere, self-hosted (`src/fonts/`, OFL). Tailwind knows only the scale in `typography.scale`; `typography.test.ts` fails on any other size, line height, or weight.

| Role | Class | Use |
|---|---|---|
| Page title | `text-title` | The one `h1` of every app page |
| Landing section | `text-headline` | Landing `h2`s |
| Card title | `text-base font-semibold` | Card and section headers |
| Key figure | `text-figure` | The one big figure of a card |
| Figure | `text-xl font-medium` | Stats, "You receive", a position's value (the same role everywhere) |
| Body | `text-sm` | Default text and every full sentence |
| Label | `text-sm font-medium` | Field and row labels |
| Caption | `text-xs` | Table headers, badges, chart text, timestamps, balance lines |

Weights: 300 for display type only, 400 body and row headers, 500 labels and figures, 600 headings and buttons. A full explanatory sentence is at least 14 px.

## Layout & Spacing

- Base unit 4 px; padding, margin, gap, and `space-*` use only `spacing.steps` (×4 px). `0.5` (2 px) is the one half step, for hairline offsets and a segmented track's inner padding (`spacing-guard.test.ts`).
- Card padding 20 px (`p-5`), 16 px for a card inside a card; inset padding 12 px; 12 px between cards; 24 px between page sections (32 px on the landing); 8 px inside a control row.
- Pages set their width with `Column`; the 16 px side gutter is never crossed at 360 px.
- Positioning offsets (`top-*`, `inset-*`) follow an element's geometry and are not part of the rhythm.

## Elevation & Depth

Depth comes from the surface layers and borders, not shadows. Cards have no shadow. `shadow-overlay` is the only shadow, used only by overlays: the Term popover, the toast, and the menus (`shadow-guard.test.ts`).

## Shapes

| Token | Value | Use |
|---|---|---|
| `rounded-pill` (`rounded-full`) | 9999 px | Buttons, segmented tracks and items, badges, chips, toggles, token icons |
| `rounded-card` | 16 px | Cards and panels |
| `rounded-inset` | 12 px | Wells: inputs, overview boxes, charts, notices |
| `rounded-tip` | 8 px | Popovers, menus, toasts, focus outlines of plain links |

The landing's framed grid (`.landing-frame`, 4 px) is the one named exception (`radius-guard.test.ts`).

## Components

All shared components live in `src/components/ui/`. U11 Phase 2 adds the flow building blocks (action card, token amount input, receive row, overview, details, slippage popover, stats strip, responsive table) here when it lands.

### Button / ButtonLink
- Variants: `primary` (filled accent), `secondary` (inset ring), `ghost`, `danger`, `quiet` (an outlined non-action, such as the theme icon); the `night*` aliases keep the same geometry.
- Sizes (`controls`): `lg` 44 px (default; the page's main action), `md` 36 px (secondary actions, row actions), `sm` 28 px (header chips, Max), `icon` 36 × 36 px.
- `arrow` adds the arrow circle for forward actions only: 28 px on `lg`, 24 px on `md`, none on `sm`.
- `pending` keeps the button in full colour and inert while the wallet or the chain works.
- Never size a button from outside (`control-guard.test.ts`).

### Segmented
The only segmented control: a `well` track, items as pills, the selected item a `surface` chip with a `line` ring. Radio semantics for a choice, tab semantics for tabs; the arrow keys move the selection; only the selected item is in the tab order. Used for funding mode, deposit asset, slippage, exit and withdraw shares, the mobile Compare tabs, and the footer theme switch. The header nav uses the same chip.

### MaxButton
The one Max: an `sm` pill, accent text on `accent-soft`, inside the amount field on the right.

### Amount field
A `well` box with a 1 px `line` border and `rounded-inset`; the amount at `text-xl`/600; the unit and Max on the right; the balance as a caption under it. Focus shows an accent border and ring.

### Card
`level="panel"` is a boxed surface (`rounded-card`, 20 px padding, `line` border); `level="section"` is unboxed under a hairline. Card titles are `text-base font-semibold`.

### DataTable
`tableClass`, `thClass`, `rowThClass`, `tdClass`: header 12/500 muted, first column left and figures right; rows 14/400 with 12 px padding (a `dense` mode, 12/400 with 8 px, for side panels); a `line` divider; no zebra striping.

### Stat
A label/value pair in a `stat-list` `<dl>`; `figure` gives the value the figure role.

### Badge
A small pill (`text-xs`, 500) in a semantic tone on its soft background: `neutral`, `accent`, `btc`, `warning`, `danger`.

### Notice
An inline message with an icon, in one of four tones: `neutral` (ink on well; information and empty states), `warning`, `danger` (errors only), `success`. An `Outcome` with `tone: "neutral"` (such as "You have no fees to claim yet.") never renders in the error colour.

### NetworkMenu
The header's network chip: a dot in the network's colour, the name (Test/Main below 400 px), a chevron; it opens a two-item menu (`menuKeys`: arrows, Home/End, Escape and Tab close, Enter and Space choose). Choosing the other network stores it and reloads.

### Wallet button
The app's own Connect and account buttons (`md`). Below 400 px the account button shows only the wallet icon; from 640 px it adds the display name.

### TokenIcon / PairIcon
The MUSD, BTC, and MEZO icons (`public/tokens/`), cropped to a circle, at 16 px inline, 20 px in chips and table rows, 24 px in card headers. `PairIcon` overlaps two by a third, the second on a `surface` ring.

### Term
A one-sentence definition of a Mezo or MezoRoute term on hover, click, tap, or Enter, on the first label or heading that names the term on a page, never inside a link, button, tab, or form label.

### StepList, PageHeader, Skeleton, Settle
Flow steps with 24 px status circles; the Amount → Confirm → Done header (the page's one numbered sequence); breathing skeletons; content that settles in on mount only.

## Motion

One curve and three durations (`motion`), from U10: `ease-smooth` for everything, `swift` for the button arrow only; `duration-fast` 200 ms, `base` 400 ms, `slow` 600 ms. Animate only meaningful state changes (hover, focus, open, success), always behind `motion-safe:`. Buttons roll their label on hover; nothing bounces or glows (`motion-guard.test.ts`).

## Responsive

- Widths checked: 360, 390, 768, 1024, 1440 px. Never a horizontal scroll at 360 px; one-column grids that grow at `lg` need `grid-cols-1`.
- Every target is at least 24 × 24 px, and 44 × 44 px below 768 px, through the `.hit` area, without growing what it looks like. Inline targets (a `Term` or a link inside a sentence) are exempt.
- The header keeps the logo, one nav link below 640 px, the network chip, and the wallet button; the theme switch moves to the footer below 768 px.
- Flow pages keep their left edge within a flow; below 1024 px the action sits in reach.

## Do's and Don'ts

### Do
- Use the tokens and the shared components; compose before creating.
- Keep one primary button per view; make equal alternatives `secondary`.
- Show loading, empty, error, and disabled states for every data-driven view; empty states are neutral.
- Say "this week's rate" next to every APR and that staked LP's swap fees go to veBTC voters.
- Give every app page exactly one `h1`.

### Don't
- Write a hex, a raw size, a radius, or a shadow outside the tokens.
- Use orange for anything but BTC exposure, or green and red for anything but signed results.
- Annualise the Stability Pool, promise a return, or show a "≈ $" line under MUSD.
- Add a second segmented style, a fourth Max, or a one-off card.
- Hide a risk the user should read before signing.

## Agent Guidelines

1. Read this file and the tokens before writing UI; change a token in `tokens.ts` and here together (the parity test checks both).
2. Prefer the components in `src/components/ui/`.
3. Keep every guard green: `typography`, `radius-guard`, `spacing-guard`, `control-guard`, `font-guard`, `shadow-guard`, `icon-guard`, `motion-guard`, `palette-guard`, `contrast`, `heading-guard`, `design-doc`.
4. Check new screens at 360 and 1440 px in both themes with the mock wallet (`AGENTS.md` → QA) before calling them done.
