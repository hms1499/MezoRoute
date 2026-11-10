# U15: a calmer Dashboard and a chart that says something

**Status:** approved in chat (10 Nov 2026); the user asked to build it straight away, so this document records the design rather than gating it. Branch `feat/u15-dashboard-calm`.

## Why

After U14 the user found the Dashboard too dense. Measured at 1440 px with MAIN on mainnet, the page is 2,582 px tall, with 18 buttons and 36 data rows. The density does not come from tight spacing. It comes from the page doing three jobs at once (status, choosing a route, explaining) with every block at the same weight:

- **Facts repeat.** BTC exposure appears three times (the stats strip, the exposure section's big figure, the Compare table). "No Trove" appears twice. The routes appear twice (Put your MUSD to work, then Compare routes), each with its own buttons.
- **Compare routes is about 45% of the page.** It is twelve aligned rows and a prose footnote. It is a decision tool, not today's status.
- **Prose footnotes sit in the main path.** For example, "Estimates in MUSD…" and "Past results, not a forecast…".
- **Two columns are lopsided.** Your positions is half empty beside Put your MUSD to work, and Your Trove is almost empty beside the chart.
- **Two block styles alternate.** Boxed cards and unboxed hairline sections take turns, so rules run everywhere.

The user also found the "If BTC moves" chart bland: "a straight line". There are two causes:

1. **The y-axis always fits the data.** Lowest to highest value, plus 8% headroom. So every position draws the same corner-to-corner diagonal, whether it holds 0.00001 BTC or all of its value in BTC.
2. **There is nothing to compare against.** The LP's value follows √(1 + move), which barely bends over ±30%, and no reference line shows what the move costs or earns.

## Goals

The Dashboard answers three questions on its first screen: what I have, what BTC can do to it, and what I can do next.

1. **Each fact in one place.** The stats strip is the only place that shows the totals.
2. **Compare routes moves to its own page,** `/compare/`, together with the testnet "Mainnet today" reference card. The Dashboard's route table links to it.
3. **One balanced grid.**
   - From `lg`, the left column holds Your positions and then If BTC moves. The right column holds Put your MUSD to work and then Your Trove. Each column has its own height, so there are no half-empty cards.
   - Below `lg`, the reading order is positions, routes, the chart, then the Trove.
4. **One block style on the Dashboard.** The exposure panel and the Trove card are boxed panels there, like the tables. Route previews keep their unboxed section.
5. **More air between blocks.** The Dashboard's rows sit 24 px apart, up from 16.
6. **The chart.**
   - **A relative scale on the value plot.** The y-range always covers today's value × (1 ± 30%), which is exactly what a position fully in BTC would do over the ±30% moves. A position half in BTC (the LP) then rises and falls about half as steeply, and a pure-MUSD position stays flat. The slope finally shows how much BTC risk the position carries. The CR plot and the landing's hero keep the fitted scale.
   - **A "Kept in MUSD" baseline.** It is a dashed line at today's value, drawn when the value plot has one solid line. The gap between the two lines is what BTC does to the position. With two lines (LP and Stability Pool), they already compare each other.
   - **The −30% and +30% end labels carry the change from today,** for example "1.89 (−16%)".
7. **The footnotes move behind Show figures** (exposure) or stay on the Compare page.

## Non-goals

- New reads. Every figure comes from the snapshots the Dashboard already reads. `/compare/` reads the same dashboard snapshot.
- Changing Compare routes' rows, maths, or copy, except its heading (the page's h1 now says it).
- The landing page, Positions, and the flow pages.
- A Compare link in the header. The 360 px header has no room: it shows one nav link below 640 px.

## Anti-goals

The design fails, even if it builds, if:

- a total shows in the strip and again as a headline figure below it;
- the chart scale makes a Stability Pool deposit look as risky as the LP;
- a card in a two-column row is half empty because its neighbour is taller;
- below `lg`, the reading order puts the chart or the Trove before the routes table;
- `/compare/` loses any row or risk that Compare routes shows today.

## Builder notes (calls made by the implementer)

- **Columns.** The two columns use `contents lg:block` wrappers, with `order-*` restoring the reading order below `lg`. This is the same technique as the Confirm overview in U14.
- **The relative scale.** It is an option on `chartGeometry`: `scale: { around, spread }`. It widens the fitted range and never narrows it.
- **Labels with change.** They come from a pure `labelText` helper in `src/lib/chart/move-chart.ts`.
- **The `/compare/` page.**
  - It uses `Column` and a PageHeader (back to the Dashboard), with the h1 "Compare routes".
  - Before a wallet connects it shows `ConnectPage`.
  - Its metadata comes from `src/lib/seo/pages.ts`.
  - Its link replaces the `#compare` anchor.
