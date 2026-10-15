# U2 — Landing redesign: dark route map and live simulator (design)

Date: 15 Oct 2026 · Follows: U1 (merged 15 Oct) · Branch: `feat/u2-landing-redesign`

## Goal

U1's landing works, but it follows a generic SaaS template (badge → headline → CTA → side card → three steps), and the user found that it looks like their earlier projects. U2 rebuilds **only the landing page** (`/` before a wallet connects). The goal is that within 30 seconds a Wave 1 judge:

- sees a product with its own identity;
- *uses* MezoRoute's core idea: two routes for MUSD and what each does to BTC risk;
- does all this before connecting a wallet.

## Research (15 Oct 2026)

Landing pages were screenshotted and compared at 1440 px: DeFi Saver, Mezo, Pendle, Euler, Sky, Morpho, Ethena, Liquity v2, and Spark (Summer.fi is winding down). Four patterns recur:

1. **The hero shows the product itself.**
   - DeFi Saver puts its real app screen in the hero.
   - Liquity v2 puts a live "Best borrow rates in DeFi" table in the hero.
2. **A strong visual signature:** Pendle's 3D sphere, Ethena's cinematic dark theme, Liquity's geometric blocks, Mezo's large italic serif.
3. **A live metrics strip in the hero:** Sky, Ethena, Pendle.
4. **Products as large tiles.**

U1's landing had all four in a muted, templated form.

## Decisions (approved in chat on 15 Oct 2026, with browser mockups)

| Topic | Decision |
|---|---|
| Scope | The landing page only. The dashboard, route pages, confirm, receipt, and positions keep U1's light Calm Finance design. |
| Direction | "B · Route map, dark". The page is dark (deep teal-black radial gradient). The visual signature is two route lines from a MUSD node: LP in teal (solid), Stability Pool in orange (dashed). Figures use a monospace font. |
| Hero content | A **route simulator** that needs no wallet and runs on live Mezo mainnet data. Visitors type an amount or pick 100 / 500 / 1,000 MUSD and see LP and Stability Pool side by side. |
| Data | Real mainnet reads only (approach 1). An illustrative simulator with fixed numbers was rejected: invented figures on a finance page break the §9 spirit. |
| Dark scope | Landing only. Header and footer turn dark while the landing is shown and return to light afterwards. |
| Motion | CSS keyframes plus two small hooks. No new dependency (no framer-motion). Everything is off under `prefers-reduced-motion: reduce`. |
| New dependency | None. JetBrains Mono comes through `next/font/google`, like Inter. |

## 1. Page structure

From top to bottom; at 375 px the same order in one column:

1. **Hero.**
   - **Left column:**
     - mono eyebrow `// route planner for MUSD on Mezo`;
     - headline "Pick a route. / Know the BTC risk.";
     - one-sentence subcopy (compare, preview the exact transaction, exit to MUSD, non-custodial);
     - primary CTA "Connect a Bitcoin or EVM wallet";
     - "How it works ↓" link;
     - the route map SVG.
   - **Right column: the simulator panel.**
   - **Below 1024 px:** the simulator follows the CTA, and the route map shrinks and sits after the simulator.
2. **Live strip.** Four mono figures from mainnet:
   - pool value (MUSD);
   - LP fees over the last 30 days (with the yearly rate, labelled "fees only");
   - Stability Pool deposits with their share of MUSD supply;
   - executor "verified ✓", linking to the explorer.
   - Shown as 2×2 below 640 px.
3. **Two routes.** Two lane cards with a teal or orange left border. Each card has:
   - a mono label (`route_01 · MUSD/BTC LP`, `route_02 · Stability Pool`);
   - its title ("Earn swap fees", "Back the system");
   - return source and main risk, both from `src/lib/routes/copy.ts`;
   - the transactions per direction:
     - LP: "enter: 1 tx (+ permit or approval) · exit: 1 tx → MUSD";
     - Stability Pool: "enter: approve + deposit · exit: withdraw".
4. **How it works.** A three-step mono timeline: 01 compare, 02 preview, 03 sign & exit. Step 03 copy: "One transaction each way after an approval where your wallet needs one; exit back to MUSD from Positions."
5. **Trust row.** Four items:
   - Non-custodial;
   - Source-verified (executor link, no admin keys);
   - Capped (max 1,000 MUSD per transaction on mainnet);
   - **Unaudited** (in orange): "Hackathon software. Use small amounts."
6. **Final CTA**, "Bitcoin wallet or EVM wallet, same routes.", followed by the dark footer.

## 2. Simulator

**Input**
- A labelled decimal input (`inputMode="decimal"`) using the existing `amountState` rules, plus preset chips 100 / 500 / 1,000 rendered as buttons.
- The default amount is 1,000.

**Rows**

| Row | MUSD/BTC LP | Stability Pool |
|---|---|---|
| Return source | "swap fees" | "liquidation BTC" |
| Last 30 days | signed MUSD change and % (`signedChange`) for the amount from `backtestRoutes(history, amount, 10n)` | the same row from the SP backtest ("no liquidations" when none reached the pool) |
| BTC exposure | `+<shareBtc> BTC` (the LP share's BTC after entry), shown in BTC orange | `0 BTC` |
| If BTC −30% | `≈ lpValueAfterDrop(positionValue, 30)` | the amount (new liquidations are not modelled) |
| MezoRoute fee | `0.1%` (the mainnet executor's `feeBps`) | `none` |

**Notes under the table**
- Always shown: "Past 30 days on Mezo mainnet, not a forecast. Estimates in MUSD. Max 1,000 MUSD per transaction on mainnet."
- Over 1,000 MUSD: a further line, "Above the mainnet limit of 1,000 MUSD per transaction."
- While Testnet is selected: "You're on Testnet: these figures are Mezo mainnet; your transactions will use test tokens."

**Button.** "Connect wallet to choose a route" opens the RainbowKit modal through `ConnectCta`.

**States**
- **Loading:** skeleton rows; the panel frame keeps its size.
- **Head read failed:** the panel shows "Live data unavailable" with the Connect button. The page stays complete and the live strip is hidden.
- **History failed:** only "Last 30 days" reads "Unavailable".
- **Invalid amount:** the `amountState` error under the input; the table keeps the last valid amount, dimmed.

## 3. Data and logic

- **History.** `MainnetReferenceData` gains `history: RouteHistory | null`; `loadMainnetReference` keeps the history it already fetches. Its existing `backtests` (for 1,000 MUSD at 0 bps) stays, so the testnet dashboard's "Mainnet today" card is unchanged. Same query key, same cache.
- **New pure module `src/lib/landing/simulate.ts`:**

  ```ts
  simulateRoutes(input: {
    reference: MainnetReference;
    history: RouteHistory | null;
    amount: bigint;
    executorFeeBps: bigint;
  }): LandingSimulation
  ```

  - **LP quote:** `quoteEntry({ reserveMusd, reserveBtc, totalSupply: lpSupply, feeBps }, amount, executorFeeBps)`.
  - **Position value:** `shareMusd + shareBtc × reserveMusd / reserveBtc`, at the pool's own price before the trade (the same rule as `compareRoutes`).
  - **BTC added:** `shareBtc`.
  - **After a 30% drop:** `lpValueAfterDrop(positionValue, STRESS_DROP)`.
  - **Stability Pool:** position = amount, BTC added = 0, after drop = amount.
  - **30 days:** `backtestRoutes(history, amount, executorFeeBps)`, or `null` without history.
  - **Errors:** a `null` quote (empty pool) gives an LP side of `{ status: "unavailable" }`.
- **Display view.** U1's `src/lib/reference/landing.ts` (`landingLive`) moves to `src/lib/landing/view.ts`, together with its tests, and grows to format the strip and the simulator rows. It keeps its tested states (loading / hidden / data) and adds "history unavailable". The strip reuses `referenceView` and `lpHistoryLine`.
- **Fee and executor.** The executor fee comes from `networks.mainnet.executor.feeBps` (10n); the explorer link comes from `explorerAddressUrl(networks.mainnet, …)`.

## 4. Visual system (landing only)

**Tokens**
- `src/lib/ui/tokens.ts` gains `night` tokens:
  - `bg` `#0A1416`, `glow` `#123B3A`;
  - `ink` `#E8F1EF`, `muted` `#9FB3AF`;
  - `line` (white 10%), `panel` (white 5%);
  - `lp` `#2DD4BF`, `sp` `#FB923C`.
- Every new text/background pair joins `TEXT_PAIRS`: night ink, muted, lp, and sp on the night background, and dark text on an lp button. The contrast test keeps them ≥ 4.5:1; if a pair fails, adjust that token, never the test.
- Tailwind reads them as `night-*` colours.

**Fonts**
- `JetBrains_Mono` through `next/font/google`, `display: "swap"`, variable `--font-mono`, Tailwind `font-mono`.
- Used for figures, labels, and the eyebrow. Body copy stays Inter.

**Dark header and footer**
- A small `SurfaceContext` provided by `AppShell`. The landing sets `"dark"` on mount and resets it on unmount.
- `Header`, `Footer`, and `MainnetBanner` read it and switch their classes. The RainbowKit modal keeps its light theme.
- The static loading shell stays light, so a brief light frame may show before the landing.

**Route map SVG.** Inline and responsive (`viewBox`), with `aria-hidden` (the simulator carries the meaning). It highlights a route when the matching simulator column or route card is hovered or focused.

## 5. Motion

All motion is CSS keyframes or transitions behind `motion-safe:`, plus the global reduced-motion rule from U1. The hooks return the final state at once under reduced motion.

| # | Motion | Spec |
|---|---|---|
| 1 | Entrance | Eyebrow → headline lines → subcopy → CTA → simulator. Fade plus 14 px rise, 600 ms, 80 ms stagger, done within 1 s. |
| 2 | Route map | Lines draw in (stroke-dashoffset, LP at 350 ms, SP at 550 ms). Then a light dot travels each line, LP every 3.2 s and SP every 4.4 s (CSS `offset-path`). |
| 3 | Simulator | When the amount changes, figures count to the new value (`useCountUp`, 450 ms, ease-out cubic) and the changed cell flashes once. Hovering or focusing a column highlights its route line. |
| 4 | Live | The "live" dot pings. Strip figures count up once when data arrives (1.1 s). |
| 5 | Scroll reveal | Sections below the hero fade and rise once when 30% visible (`useInView`, IntersectionObserver; without it they show at once). Route cards lift 3 px on hover and highlight their route line. |
| 6 | Timeline | The 01 → 03 line fills over 1.4 s when it enters the viewport. |

**Not included:** parallax, cursor-follow effects, continuously moving backgrounds.

**Layout stability.** Counting figures use tabular numbers inside fixed-width cells, so nothing shifts.

## 6. Copy rules (§9) carried over

- "Estimated" or "≈" on every pre-confirmation figure.
- "Past 30 days, not a forecast"; no annualised Stability Pool figure.
- No "guaranteed", "risk-free", or MEZO/gauge reward claims.
- Mainnet figures are labelled as mainnet on both networks.
- "Unaudited" stays visible.

## 7. Testing and QA

**Unit tests (TDD, Vitest)**
- `simulateRoutes`:
  - LP position value and BTC added equal `compareRoutes` for an empty-wallet snapshot built from the same pool and amount;
  - the −30% value;
  - the Stability Pool side;
  - `history: null` → no 30-day figures;
  - an empty pool → LP unavailable;
  - amounts of 100, 1,000, and 10,000.
- The count-up interpolation function: starts at `from`, ends exactly at `to`, eases out, and returns `to` immediately when reduced motion is set.
- The landing view states: loading, data, head failed (hidden strip with simulator message), history failed.
- The contrast test with the new night pairs.
- `loadMainnetReference` returns `history`.

**QA (Playwright, as in `docs/STATUS.md`)**
- `/` without a wallet on testnet and mainnet at 360 / 768 / 1024 / 1440 px: `scrollWidth ≤ innerWidth`; screenshots.
- Simulator: presets and typing update the rows; 10,000 shows the cap note; a comma shows the amount error.
- Delayed mainnet RPC shows skeletons. Aborted mainnet RPC gives "Live data unavailable" with a complete page. A failed history read leaves only the 30-day row "Unavailable".
- Reduced motion: no element animates; figures show final values at once.
- Keyboard: tab order follows the layout; chips and the input show the focus ring on the dark background.
- Connecting a wallet returns the header and footer to light.
- The build's First Load JS for `/` stays within +5 kB of 92 kB.

## 8. Estimate and cut line

Estimate: about 1–1.5 days, finished before V1. If time runs short, cut in this order:

1. The timeline fill (motion 6).
2. The travelling dots (keep the draw-in).
3. The count-up in the strip (keep it in the simulator).

The simulator, dark direction, and copy rules are never cut.

## Done when

- The landing matches sections 1–6 and passes the QA list.
- `PRODUCT_SPEC.md` §9 notes that the landing has a dark route-map design while the app stays light.
- The `AGENTS.md` frontend design-system bullet notes the `night` tokens and the `SurfaceContext`.
- `docs/STATUS.md` marks U2 done.
