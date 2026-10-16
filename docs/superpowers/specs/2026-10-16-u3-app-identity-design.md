# U3 — One identity from landing to app

**Date:** 16 Oct 2026 · **Branch:** `feat/u3-app-identity` · **Follows:** U1 (`2026-10-15-u1-ui-polish-design.md`), U2 (`2026-10-15-u2-landing-redesign-design.md`)

## 1. Why

A design review on 16 Oct (landing plus 8 app screens at 1280 and 390 px, mock wallet on testnet) found that the landing and the app read as two products. A judge clicks Connect on the dark route-map landing and lands on a light, generic teal dashboard made of identical white cards. The product's one promise, "Know the BTC risk", shows up in the app as the same four-row table on three pages. The review listed ten findings; the user asked to fix all ten and delegated every design call (`AGENTS.md` → Senior calls). This document is those calls.

The deadline matters: Wave 1 closes 26 Oct (target 25 Oct), and V1 (public URL) and D1 (README, deck, video) still follow. U3 must land in about three working days, so it changes the look through the existing semantic tokens and shared components, not page by page.

## 2. Goals, non-goals, anti-goals

**Goals**

1. Landing and app share one palette, one type system, and one meaning per colour.
2. One signature visual, the **"If BTC moves" chart**, used in the landing hero and in the app wherever the drawdown table lives today.
3. Every page of a flow keeps its content on the same column edges.
4. Each view has one primary object; everything else is quieter.
5. Every figure appears once per view.
6. Compare routes shows results without typing.
7. A blocked action offers the way out, not just the reason.
8. One numbered sequence per page.
9. Positions labels say which value is which.

**Non-goals**

- No new routes, contracts, maths, or data sources. The chart reuses the existing exposure maths, extended from drops to price moves in both directions.
- No light/dark theme toggle. The whole product becomes dark.
- No chart library: the chart is hand-written SVG, like `RouteMap` today.
- No copy rewrite beyond what each finding needs.

**Anti-goals (a failure even if it works)**

- A figure or behaviour changes: every quote, minimum, gas budget, and simulation stays byte-for-byte the same. The changes are visual and navigational only.
- Text contrast drops below 4.5:1, or the 360 px header or any page overflows horizontally.
- Motion added to the app. Motion stays on the landing, behind `prefers-reduced-motion: no-preference`.
- Losing the accessible table. The chart is an addition for sighted users; the figures stay available as a real table.

## 3. Design system

### 3.1 Palette (one set, dark)

The app takes the landing's night palette. The semantic token **names** stay (`canvas`, `ink`, `muted`, `line`, `accent`, `btc`, `danger`, `warning`), so most components change only through `tokens.ts`. One new surface token replaces `bg-white`. The landing's `night.*` tokens become aliases of the same values (or are migrated; builder's choice), so there is one source.

| Token | Hex | Role |
|---|---|---|
| `canvas` | `#0A1416` | page background (deep teal-black, with the existing `night-glow` only on the landing) |
| `surface` (new) | `#162022` | panels (replaces every `bg-white`) |
| `inset` (new) | `#0F1A1C` | wells inside a panel: chart area, notices, the amount input |
| `line` | `#222B2D` | hairlines and borders |
| `ink` | `#E8F1EF` | text |
| `muted` | `#9FB3AF` | secondary text |
| `accent` / `lp` | `#2DD4BF` | actions, focus rings, and the LP route; `onAccent` `#062221` is text on it |
| `sp` | `#A5B4FC` | the Stability Pool route (**changed from orange**) |
| `btc` | `#FB923C` | BTC exposure figures only |
| `danger` | `#F87171` | liquidation, errors |
| `warning` | `#FCD34D` | caution (below the 160% floor, unconfirmed) |

`*-soft` backgrounds become the colour at about 12% over `surface`, flattened to a solid hex so the contrast test can check them (as U2 did).

**One meaning per colour.** Orange now means BTC exposure everywhere, which is U1's rule. The Stability Pool, orange on the U2 landing, becomes lavender on the landing and in the app. That removes the clash where the simulator shows an orange BTC figure in the LP column under an orange "Stability Pool" header. Teal stays both the action colour and the LP colour, as U2 set it. Buttons stay teal on SP pages too, and the SP route is marked by its lavender line and heading marker.

`contrast.test.ts` gets every new text pair, including `sp`, `btc`, `danger`, and `warning` on `surface`, `canvas`, and `inset`, and `onAccent` on `accent`. `html` sets `color-scheme: dark`. That also closes U2's "first frame and overscroll bands are light" deferral, because `body` is dark from the first paint. RainbowKit switches to `darkTheme` with the teal accent and `onAccent` foreground.

### 3.2 Type

- **Inter** for all UI text and prose, as now.
- **JetBrains Mono** (already loaded) **for key figures only**:
  - the big number on a panel (BTC exposure, "You receive", position value);
  - the amount input;
  - chart labels;
  - the simulator figures.

  Stat lists and tables keep Inter with tabular figures (`globals.css` rule unchanged), because mono widens long BTC amounts past 360 px.
- **Mono stops being a label voice.** The landing's `// …` eyebrows, `route_01 ·` labels, and `·`-joined meta strings go. Sections are introduced by their heading alone; a route is named by its plain name with a colour marker.
- **Scale** (px, size/line-height):
  - page title 28/34 semibold;
  - section heading 16/24 semibold;
  - key figure 28/32 mono medium;
  - body 14/20 and 16/24;
  - caption 12/16.

  The landing hero keeps 40/48 (`sm:` 48).

### 3.3 Surfaces and hierarchy (finding 5)

Three levels, used by rule:

1. **Panel** (`surface`, 1 px `line` border, radius 16, **no shadow**): only the page's working objects.
   - Dashboard: Next step and Compare routes.
   - Route pages: the form and the summary/action panel.
   - Positions: each position.
2. **Section** (no box): a 16 px heading and a top hairline on `canvas`. Used for everything secondary: Your Trove, Positions summary, What happens, Risks, Mainnet today (dashed hairline, as the reference marker).
3. **Inset** (`inset`, radius 12): wells inside a panel. Used for the chart, notices, and the amount input.

Shadows (`shadow-card`, `shadow-raised`) go, except the fixed mobile bar, which keeps a top hairline and a solid `surface` fill. `Card` gains a `level` (`panel` | `section`); the builder picks the API.

### 3.4 Motion

Unchanged on the landing, minus the travelling dots (see 4.2). The app has none beyond U1's existing spinners and toasts.

## 4. The signature: "If BTC moves" chart (findings 2 and 3)

### 4.1 The chart

One component, `BtcMoveChart`, used in two places: the landing hero and the app's exposure sections.

**Axes**

- x axis: the BTC price move, from **−30% to +30%**, with "Today" at 0, sampled every 5% (13 points).
- One or two plots, stacked, sharing the x axis.

**Plot A, "Value in MUSD"** (shown when there is an LP or Stability Pool amount):

- LP line in teal: `lpValue × √(1 + move)`, the existing constant-product approximation (`lpValueAfterDrop`) generalised to rises.
- SP line in lavender: `spDeposit + spBtcGain × price′`.
- On route previews, the "before" line is drawn faint and the "after" line solid.

**Plot B, "Trove CR"** (shown when there is a Trove):

- The CR line in `ink`.
- A `danger` band below MCR (110%), labelled "Liquidation".
- A `warning` band from MCR to the 160% floor (`src/lib/trove/constants.ts`), labelled "Below 160%".
- If the line crosses MCR inside the range, the crossing gets a dot and a label with the BTC price: "Liquidated below 26,832".

**Labels**

- End labels at −30% and +30% carry the figure in mono (for example "832.57").
- The "Today" figure sits at the marker.
- No gridlines beyond three horizontal hairlines.

**Accessibility**

- The SVG is `role="img"` with an `aria-label` that states the −30% outcome in words.
- The existing table (rows Now, −10%, −20%, −30%) stays in the DOM under a `<details>` labelled "Show figures". Closed by default; it is still a real table with its caption.
- The liquidatable message under the table stays visible outside the disclosure.

**Size.** Full width of its container; about 160 px tall per plot (120 px below 640 px).

**Maths.** A new pure function next to `drawdownScenarios` (for example `moveScenarios(snapshot, current, moves)`). It reuses `collateralRatio` and the LP factor; the existing `drawdownScenarios` and its tests stay as they are. Values round down, like today.

### 4.2 The landing hero (finding 3)

`RouteMap` is replaced by `BtcMoveChart`, fed by the simulator's amount and mainnet data, with Plot A only.

The old picture implied "SP falls, LP rises". The new one shows the truth:

- the SP line stays flat at the deposit (no BTC exposure until liquidations);
- the LP line rises with BTC and falls with it (about half the position is BTC).

Captions under the chart, in Inter:

- "LP: about half in BTC, so it moves with the price."
- "Stability Pool: stays in MUSD; BTC arrives only from liquidations."

Motion: the two lines draw in once on load (`landing-draw`), and the simulator hover still thickens the matching line. The travelling dots go, which also closes U2's missing `offset-path` fallback. If the reference data has not loaded yet, the chart draws with the shape for 1,000 MUSD at the current mainnet price as soon as it arrives. Before that it shows the axes and the "Today" marker only, at the same height, so nothing shifts.

### 4.3 In the app

`ExposurePanel` keeps its title, total, and breakdown. The drawdown table is replaced by the chart plus the "Show figures" disclosure. This applies on the dashboard, the LP route (before → after), and the SP route (before → after).

The breakdown lists its sources only when there are **two or more** (one source equal to the total is noise; finding 6).

## 5. Pages

### 5.1 Dashboard (findings 5, 6, 7)

The **SummaryStrip is removed**. Each of its figures already lives in its section:

- MUSD in wallet moves into the Next step footer.
- BTC for gas is there already.
- BTC exposure has its own section.
- Trove CR is in Your Trove.

```
lg (≥1024)                                        below 1024, in this order
┌ Next step (panel) ──────────────┐  BTC exposure (section)      Next step
│ Borrow up to 479.9 MUSD …        │  0.099499 BTC  (mono 28)     BTC exposure + chart
│ [Borrow & Deploy]                │  [ If BTC moves chart ]      Your Trove
│ MetaMask · 0xe6…0D56             │  ─────────────────────       Compare routes
│ MUSD in wallet 0 · gas 0.000001  │  Your Trove (section)        Positions
└──────────────────────────────────┘  ─────────────────────       Mainnet today
┌ Compare routes (panel) ─────────┐  Positions (section)
│ amount prefilled (5.2)           │
└──────────────────────────────────┘
─ ─ ─ Mainnet today (section, dashed rule) ─ ─ ─
```

On mobile the user's own Trove comes before the comparison. The order is set with grid `order` utilities, so desktop is unchanged.

### 5.2 Compare routes default amount (finding 7)

The input starts filled, so the table renders on arrival:

- with **wallet MUSD ≥ 1**, the default is `min(wallet MUSD, network entry cap)`, rounded down to a whole MUSD;
- otherwise it is **1,000 MUSD** (the landing's default; equal to the mainnet cap), with a muted line under the input: "Example amount. You have 0 MUSD."

The user can clear or edit it as now. "Choose LP" and "Choose Stability Pool" carry the amount as they do today, and the route page then handles a balance shortfall (5.4).

### 5.3 Flow pages keep one column (finding 4)

Every page of a flow uses `RouteLayout`'s wide grid: a two-thirds content column and a one-third sticky action column. The back link, stepper, and title sit on the content column's left edge on every step.

| Page | Content column | Action column |
|---|---|---|
| LP / SP amount (`/route/lp/`, `/route/stability-pool/`) | form, What happens, BTC exposure, Risks | Estimated outcome + Review (unchanged) |
| LP / SP confirm (`…/confirm/`) | Review your deposit (the quote details and timer) | the Confirm steps |
| Receipt (`/tx/`) | status and the transaction details | View positions / View on explorer / Back to dashboard |
| Exit, SP withdraw | form and estimated result (unchanged) | Confirm (unchanged) |
| Positions (`/positions/`) | one panel per position, fees | totals (5.6) and the chart for positions |

Below 1024 px all of these stack in the order above, and the `MobileBar` keeps the primary action where it exists today. `Column width="narrow"` remains only for pages outside flows (the invalid-hash receipt and the connect card).

### 5.4 Blocked states offer the way out (finding 8)

When the amount exceeds the wallet's MUSD (`insufficient-balance`), the `BlockNotice` in the summary panel and the mobile bar keeps its message and adds up to two actions:

1. **"Borrow & Deploy instead"**:
   - on the LP route only;
   - only for an EOA with a Trove whose borrowing room is at least 1 MUSD and with no recovery mode (the same checks the Next step card uses);
   - switches to `mode=borrow` with `amount = min(typed amount, borrowing room)`.
2. **"Use my balance (N MUSD)"**: when the balance is above 0; sets the amount to the exact balance, like Max.

When neither applies, it offers **"Get MUSD in the Mezo app"**, an external link to `network.mezoAppUrl`.

These are new `Recovery` kinds, rendered by the same notice. The toast mapping is unchanged.

### 5.5 One numbered sequence per page (finding 9)

- `PageHeader`'s Amount → Confirm → Done stepper is the only numbered sequence.
- `StepList` nodes lose their numbers and show status glyphs only: an empty ring for upcoming, the current ring, the wallet icon, the spinner, a check, or an X. The list stays an `<ol>`.
- The receipt page drops its Submitted → Confirming → Confirmed mini-stepper.
  - Once a hash exists the header stepper is on **Done** (step 3).
  - Step 3's node shows the spinner while pending, the check when confirmed, and the amber state for unconfirmed (never "Failed", as U1 ruled).
  - The status sentence below the title keeps the wording.

### 5.6 Positions labels (finding 10)

- The page header figure "Value (estimated)" becomes **"Value at the BTC price"**, with a caption: "Oracle price, before exit costs".
- Each LP panel's headline uses the same label.
- "If you exit everything now" becomes **"Exit to MUSD now"**, with the caption "Estimated, after the pool fee and price impact". It stays the bold row.
- When the two differ by more than 0.5%, a muted line explains the gap: "Exiting sells the BTC half at the pool price, which differs from the oracle."
- The header's BTC exposure reads **"BTC exposure in these positions"**, which closes U1's dashboard/positions wording deferral.
- The cost-basis skeleton gets visible text, "Reading your history…", and the same in its status role (closes U1's screen-reader deferral for it).

## 6. Small items folded in

- **Header at ≤ 640 px:** no RainbowKit emoji avatar. The account button shows a wallet icon and a short address (`0xe6…56`), sized so the 360 px header still fits (it has 1 px to spare; measure it).
- **Landing:** the mono eyebrows and `route_N ·` labels go (3.2). "How it works" keeps its 1-2-3 because it is a real sequence. The trust row's eyebrow becomes a real `h2` "Before you connect", which closes U2's "eyebrow is the only heading" deferral.

## 7. Testing and QA

- **Unit tests:**
  - `moveScenarios`: points, rounding, rises vs drops, LP factor parity with `lpValueAfterDrop` at −10/−20/−30.
  - The MCR crossing.
  - The Compare default amount rule.
  - The recovery selection rule.
  - The contrast pairs.
  - The `simulate.ts` parity test keeps passing.
- **Component tests** where the logic lives in a component (receipt step state, breakdown shown only with two or more sources).
- **`npm test && npm run build`** green; `forge` untouched.
- **Playwright QA with the keyless mock wallet** (AGENTS.md):
  - every screen at 360, 390, 768, 1280 px on testnet and mainnet;
  - no horizontal scroll;
  - focus rings visible on dark;
  - reduced motion;
  - the three QA accounts (no Trove, can borrow, at risk: check the liquidation crossing label on −30%);
  - `0x375a…` for positions;
  - the flow from amount to confirm, which must not shift the left edge (compare element x positions);
  - the Passport/RainbowKit modal in dark.
- **Screenshots:** viewport or element screenshots, not full-page (U2 note).

## 8. Deferred items this closes

- U2:
  - light first frame and overscroll;
  - no `offset-path` fallback;
  - SP glow clipped by its mask (the mask goes);
  - eyebrow as the only heading.
- U1:
  - "BTC exposure" meaning differs between the dashboard and positions;
  - cost-basis skeleton without text.

## 9. Left to the builder

- The `Card` API for levels, the `BtcMoveChart` prop shape, and whether `night.*` becomes aliases or is migrated.
- The exact `*-soft` hexes, as long as the contrast test passes.
- The chart's label collision handling at 360 px (for example, drop the +30% label below 400 px).
- The order of tasks. A sensible order:
  1. tokens and the dark switch;
  2. surfaces;
  3. chart maths, then the component;
  4. landing hero;
  5. app exposure sections;
  6. dashboard;
  7. flow layout;
  8. steppers;
  9. blocked recovery;
  10. positions labels;
  11. small items.
