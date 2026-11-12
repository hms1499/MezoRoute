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
- One page width inside the shell (16 px gutter below 640 px, 24 px above, 1104 px content from 1200 px): every page frames with `Column`, so the banner, the h1, and the first block share one left edge on every page. Flow pages lay out in Positions' grid (`FlowColumn`). The 16 px side gutter is never crossed at 360 px.
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

Shared components live in `src/components/ui/`; the flow building blocks (U11 Phase 2) live in `src/components/flow/`.

### Button / ButtonLink
- Variants: `primary` (filled accent), `secondary` (inset ring), `ghost`, `danger`, `quiet` (an outlined non-action, such as the theme icon); the `night*` aliases keep the same geometry.
- Sizes (`controls`): `lg` 44 px (default; the page's main action), `md` 36 px (secondary actions, row actions), `sm` 28 px (header chips, Max), `icon` 36 × 36 px.
- `arrow` adds the arrow circle for forward actions only: 28 px on `lg`, 24 px on `md`, none on `sm`.
- `pending` keeps the button in full colour and inert while the wallet or the chain works.
- Never size a button from outside (`control-guard.test.ts`).

### Segmented
The only segmented control: a `well` track, items as pills, the selected item a `surface` chip with a `line` ring. Radio semantics for a choice, tab semantics for tabs; the arrow keys move the selection; one item is in the tab order: the selected one, or the first enabled one when the selected item is disabled. Used for funding mode, deposit asset, slippage, exit and withdraw shares, the mobile Compare tabs, and the footer theme switch. The header nav uses the same chip.

### MaxButton
The one Max: an `sm` pill, accent text on `accent-soft`, inside the amount field on the right.

### TokenAmountInput (amount field)
A `well` box (`rounded-inset`). Top row: the label ("You deposit", "You borrow", "You exit") on the left, "Balance x" and `Max` on the right. Second row: the amount at `text-title`/600 and a token chip (`TokenIcon` 20 + symbol). A note (the BTC gas reserve) sits on a caption line inside the box. Two tokens (MUSD | BTC outside Borrow & Deploy) turn the chip into a menu (`menuKeys`, an overlay); otherwise it is static. `max: null` disables Max (BTC while the gas price is unknown; `tokenAmountMax` keeps the reserve). Errors sit under the box in `danger` with an icon. Percent mode (exit, withdraw) shows the amount the preset picks and the 25 / 50 / 75 / Max `Segmented` under the box. In amount mode the digits show grouped (`1,000`) while the field is not focused and raw while it is (`groupAmount`, `src/lib/flow/group-amount.ts`); only text that is well-formed thousands grouping loses its commas (`stripGrouping`), so a decimal comma ("0,5") stays a field error and never parses as 5. The URL, the parsed amount, and Max always carry ungrouped digits.

### ActionCard
A flow's one card: icon (`PairIcon` or `TokenIcon` 24) and route name, one figure on the right (this week's APR, the pool's swap fee, "No fee · BTC from liquidations", "No MezoRoute fee"); then tabs and settings, the inputs, the overview, the page's only primary (`lg`, full width, `arrow`), and one risk line linking to `#details`. Below 640 px the figure moves under the title.

### ReceiveRow
A `well` box: "You receive", the `xl`/500 figure, its token or pair icon, and the minimum on a caption line. A note (a gap to what was put in, a price warning) carries a leading `CircleAlert` in `warning-ink` and may end with an optional "· action" link.

### Overview
A bordered `rounded-inset` box of `dl` rows: label `sm`/500 muted, value right-aligned (500), an optional caption under the value, `tone` `btc` | `positive` | `negative` | `warning` (`warning-ink`: a figure still allowed but costly, the LP price impact from 1%; never a signed result) and carries a leading `CircleAlert` (a `btc` row does not; a warning row's caption is indented below 640 px to line up with its value). It holds fees, price impact, the Staking row (its switch is the stake control), BTC exposure change, network fee, the Trove change, and on Confirm every amount and minimum, in two columns of groups from `lg` (`columns={2}`: the even groups, You pay and Terms, stack on the left and You receive on the right, each column at its own height; one group keeps the full width). A block the typed amount causes is said at the field (`aria-invalid` and the message under it, `src/lib/flow/field-error.ts`); the notice keeps only its recoveries.

### Planner precision
On the two planner pages (`/route/lp/`, `/route/stability-pool/`) one precision per unit: MUSD 2 decimals (`musdShort`), LP 4 (`lpShort`), BTC 6, MEZO 2. Confirm, Positions, withdraw, and receipts keep the longer 4 / 6 figures (`musd`, `lp`, `btc`). Truncated, and a non-zero amount never reads as 0.

### Details
A `<details>` under the action card (closed by default on amount pages) with What happens, the "If BTC moves" chart, and the full risk list. Confirm pages show the full risk list in the card, always open (`ConfirmCard`).

### SlippagePopover
"Slippage 1%" with a gear (`quiet sm`) in the card's top-right; the overlay (`rounded-tip`, `shadow-overlay`) holds the 0.5 / 1 / 2% `Segmented`, closes on Escape or a click outside, and returns focus to the trigger. A 2% setting also shows the warning notice in the card.

### FlowColumn
Every flow page (amount, confirm, exit, withdraw, receipt): `PageHeader`, then Positions' grid (`grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start`): the flow's card two thirds (`lg:col-span-2`) and an aside one third from `lg`, stacked under the card below it. The aside holds facts the page already read (Before you sign, the position, the Trove, the transaction; on Confirm the risks from `lg`, which stay in the card above the steps below it). A route's loading, error, connect, and no-executor states use `FlowState`: the same grid with an empty aside, so the card's edge and width never move while data arrive. It replaced `RouteLayout` and `MobileBar`.

### StatsStrip
A panel of 3–4 stats (`xs` label, `xl`/500 value, optional caption), split by hairlines from 768 px, a 2 × 2 grid below. A value that could not be read says "Not readable", never 0. On the Dashboard it is the only place a total appears (U15): no block below repeats it as a headline figure.

### Dashboard
The strip, then one `DashboardGrid` of boxed panels 24 px apart: Your positions and If BTC moves on the left, Put your MUSD to work and Your Trove on the right, each column at its own height; below `lg` the order is positions, routes, chart, Trove. Decision tools (Compare routes, the mainnet reference) live on `/compare/`, linked from the route table.

### If BTC moves (value chart)
On the Dashboard the value plot is to scale: its range always holds today's value × (1 ± 30%), what a position fully in BTC would do, so the slope shows how much of the position moves with BTC. One solid line gets a dashed `muted` Kept in MUSD line at today's value; the −30% and +30% labels add their change from today; an end lower than today has its label below the point (and a label with no room on its side takes the other). Route previews and the landing keep the fitted axis.

Every chart (landing, Dashboard, Positions, route previews, Trove pages) shares one look: smooth monotone curves through the real points (never a decorative wave: the lines say what the maths says), the gap between a line and its reference (Kept in MUSD, or the Stability Pool beside the LP) shaded `btc` at 14% where BTC costs the position and `accent` where it pays, a legend in the caption row, and a readout above the plot ("If BTC −15% · 2.08 MUSD · −0.18 (−8%)", "was …" on previews, the band's name for a CR). The readout rests at −30% and follows the pointer, a tap, or the arrow keys: each plot is a `role="slider"` whose value text is the readout. A CR line is redrawn in `warning-ink` under 160% and `danger` under 110%.

### Card
`level="panel"` is a boxed surface (`rounded-card`, 20 px padding, `line` border); `level="section"` is unboxed under a hairline. Card titles are `text-base font-semibold`.

### DataTable
`tableClass`, `thClass`, `rowThClass`, `tdClass`: header 12/500 muted, first column left and figures right; rows 14/400 with 12 px padding (a `dense` mode, 12/400 with 8 px, for side panels); a `line` divider; no zebra striping. The `DataTable` component renders a `<table>` with a visually hidden caption from 768 px and a list of cards below (the first column as the title, the rest as label/value pairs, the `action` column full width). `empty` is one neutral row; `expand` adds a Details toggle per row (Positions).

### Stat
A label/value pair in a `stat-list` `<dl>`; `figure` gives the value the figure role.

### Badge
A small pill (`text-xs`, 500) in a semantic tone on its soft background: `neutral`, `accent`, `btc`, `warning`, `danger`.

### Notice
An inline message with an icon, in one of four tones: `neutral` (ink on well; information and empty states), `warning`, `danger` (errors only), `success`. An `Outcome` with `tone: "neutral"` (such as "You have no fees to claim yet.") never renders in the error colour.

### NetworkMenu
The header's network chip: a dot in the network's colour, the name (Test/Main below 400 px), a chevron; it opens a two-item menu (`menuKeys`: arrows, Home/End, Escape and Tab close, Enter and Space choose). Choosing the other network stores it and reloads.

### Wallet button
The app's own Connect and account buttons (`md`). Below 400 px the account button shows only the wallet icon, the short address from 400 px, and the display name from 768 px (at 640 px the name pushed the connected header past the page). The header gap is 12 px from 640 to 767 px.

### TokenIcon / PairIcon
The MUSD, BTC, and MEZO icons (`public/tokens/`), cropped to a circle, at 16 px inline, 20 px in chips and table rows, 24 px in card headers. `PairIcon` overlaps two by a third, the second on a `surface` ring.

### Term
A one-sentence definition of a Mezo or MezoRoute term on hover, click, tap, or Enter, on the first label or heading that names the term on a page, never inside a link, button, tab, or form label.

### StepList, PageHeader, Skeleton, Settle
Flow steps with 24 px status circles; the Amount → Confirm → Done header (the page's one numbered sequence); breathing skeletons; content that settles in on mount only.

## Motion

One curve and three durations (`motion`), from U10: `ease-smooth` for everything, `swift` for the button arrow only; `duration-fast` 200 ms, `base` 400 ms, `slow` 600 ms. Animate only meaningful state changes (hover, focus, open, success), always behind `motion-safe:`. Buttons roll their label on hover; nothing bounces or glows (`motion-guard.test.ts`).

## Responsive

- Widths checked: 360, 390, 768, 1023, 1024, 1440, 1920 px (1023/1024 is the `lg` step where the aside moves beside the card). Never a horizontal scroll at 360 px; one-column grids that grow at `lg` need `grid-cols-1`.
- Every target is at least 24 × 24 px, and 44 × 44 px below 768 px, through the `.hit` area, without growing what it looks like. Inline targets (a `Term` or a link inside a sentence) are exempt.
- The header keeps the logo, one nav link below 640 px, the network chip, and the wallet button; the theme switch moves to the footer below 768 px.
- Every page keeps one left edge (`Column`, `FlowColumn`, `FlowState`); the action sits in the card, so no page needs a fixed bottom bar.
- Below 768 px tables become card lists and stats strips a 2 × 2 grid.

## Do's and Don'ts

### Do
- Use the tokens and the shared components; compose before creating.
- Keep one primary button per view; make equal alternatives `secondary`.
- Show loading, empty, error, and disabled states for every data-driven view; empty states are neutral.
- Say "this week's rate" next to every APR and that staked LP's swap fees go to veBTC voters.
- Give every app page exactly one `h1`.
- Give every route its own title: an entry in `src/lib/seo/pages.ts` and a server segment `layout.tsx` that exports it (titles never come from client code). An unknown URL lands on the MezoRoute 404 (`not-found.tsx`).
- Give a page with nothing to act on an empty state that leads somewhere (SP withdraw with no deposit and no gain offers a deposit), not a disabled form.

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
