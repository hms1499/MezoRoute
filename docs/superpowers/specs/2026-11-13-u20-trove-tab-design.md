# U20: Trove tab (`/trove/`)

Status: design approved in chat (13 Nov 2026, mockup v2 at `.superpowers/brainstorm/89663-1794534797/content/trove-page-v2.html`, git-ignored). Branch `feat/u20-trove-tab`.

## 1. Intent

MezoRoute's most distinctive feature is its Trove actions (Open with leverage, Leverage, Unwind, Close in one transaction through a flash swap, L1). Today they live only as buttons at the bottom of the Dashboard's "Your Trove" card, and a wallet without a Trove (every mainnet wallet the team uses) sees an almost empty card. There is no `/trove/` page, although `/trove/{open,unwind,close,leverage}/` exist.

U20 gives the Trove its own tab and page, shaped after the loan screen of Liquity V2's official frontend (`liquity/bold`, `frontend/app/src/screens/LoanScreen/`), which Mezo's MUSD is a fork of, and after Mezo's own borrower guidance. The user asked for researched practice, not invention. The five research points this design applies:

1. Two labelled risk levels, as in Liquity V2: **Liquidation risk** and **Redemption risk**, each Low / Medium / High with a coloured dot.
2. A **Loan | Multiply** view switch over the same position (Loan leads with total debt, Multiply with net value and leverage).
3. Say the consequence, not just the number: how far BTC has to fall before liquidation.
4. Mezo's guidance: "Treat 110% as the tripwire, not a target"; suggest 150% or more; interest raises the liquidation price over time. Name the price source (Mezo's oracle, read at a block).
5. Liquity's "Loan partially redeemed · N redemptions since your last action" notice. **Deferred** (§8): it needs a per-Trove scan of redemption events.

Success: a judge or user opens one tab and sees the Trove's state, both risks in plain terms, and every MezoRoute action on it; a wallet with no Trove (or no wallet) learns what a Trove is, what Mezo requires, and what MezoRoute adds.

## 2. Goals, non-goals, anti-goals

Goals
- `/trove/` page with two states: with a Trove (§4), and no Trove or no wallet (§5).
- Header nav item **Trove** between Positions and Proof; a footer link.
- The Dashboard's Trove card becomes a summary that leads to `/trove/` (§6).
- Read without a wallet, like the planners (U13, U17).

Non-goals
- No new contract or write path. Add collateral, borrow, repay, and withdraw stay in the Mezo app ("Manage loan").
- No change to the existing flows `/trove/{open,unwind,close,leverage}/` and their Confirm pages (they still require a wallet), except that their back link becomes "Back: Trove" to `/trove/` (the Dashboard no longer carries the actions). The mobile header on those flow pages is unchanged.
- No change to the at-risk rule (`troveHealth`, a 30% BTC drop below the MCR), the `TroveWarning` on the Dashboard, or the 160% safety floor (`CR_SAFETY_FLOOR`).
- No redemption history (§8), no alerts, no mainnet Trove runs (user's mainnet budget).

Anti-goals
- A softened label over a dangerous number: the risk level never replaces the ratio; both are shown.
- A second set of figures that disagrees with the Dashboard or the flows: the page uses the same snapshot and maths (`useTroveSnapshot`, `collateralRatio`, `liquidationPrice`, `borrowHeadroom`-equivalent, `redemptionQueue`).
- Protocol statistics in the primary view: system figures stay in the aside.

## 3. Risk levels (decided)

**Liquidation risk** (Liquity V2 `getLiquidationRisk`: LTV above 54% of the max LTV is medium, above 73% is high; Mezo's max LTV is 1 / MCR). In collateral-ratio terms, with `cr` and `mcr` as 1e18 fixed point:
- `liquidatable` when `cr < mcr` (shown as **Liquidatable**, danger tone; replaces the level)
- `high` when `cr < max(mcr × 100 / 73, mcr × 100 / 70)`: Liquity's line (≈ 150.7% at MCR 110%) raised to the Dashboard's existing at-risk line (`troveHealth`: a 30% drop reaches the MCR, ≈ 157.1%), so "High" and the at-risk warning always agree (builder check, my call: Liquity's band alone would read Medium next to an "at risk" warning between 151% and 157%)
- `medium` when `cr < mcr × 100 / 54` (≈ 203.7%)
- `low` otherwise
- No debt (cr null): not applicable, shown as "—".
Displayed thresholds round **up** to whole percent ("Low from 204%", "High below 158%"). The levels are display labels only: the Dashboard's at-risk warning and the 160% floor are unchanged (user decision, 13 Nov).

**Redemption risk** (Liquity V2 `getRedemptionRisk`: share of all debt in front of the Trove; over 60% low, 5% to 60% medium, under 5% high):
- `debtAhead` from `redemptionQueue(queue, account, null, mcr)` (existing, NICR order, ties ahead, Troves under the MCR skipped).
- Denominator: the sum of every queue entry's debt (the same read, so both numbers come from one moment). Builder's call if `system.debt` from the snapshot is equivalent; the queue sum is the default.
- `low` if `debtAhead / total > 0.60`, `medium` if `> 0.05`, else `high`.
- Not applicable ("—") when the Trove is under the MCR (redemptions skip it) or the queue read failed ("Not readable", the rest of the page still shows; the queue already fails alone today).

Live check (13 Nov, testnet QA wallet `0xe618…0D56`): CR 282.9% → Low; 428,070,190 of 429,526,842 MUSD ahead (99.7%, place 355 of 370) → Low.

## 4. Page with a Trove

Order (desktop from `lg`, the Positions grid: main two thirds, aside one third; below `lg` one column in this order):

1. `h1` "Trove", one-line subtitle ("Your MUSD loan on Mezo, backed by BTC. Unwind, Close, and Leverage each run in one transaction through MezoRoute; anything else opens the Mezo app.").
2. Notices, only when they apply (existing components and copy): the Trove warning (at risk / liquidatable), Claim surplus BTC, Recovery Mode with Repay from wallet.
3. **Summary panel** (one `Card`):
   - The Dashboard's Healthy / At risk / Liquidatable badge (`HEALTH_TAG`) is replaced here and on the Dashboard card by the two levels.
   - Header row: the headline figure (left) and the `Segmented` Loan | Multiply switch (right).
   - Risk row: Liquidation risk and Redemption risk with dots (glossary `Term` on both labels; new glossary entries, one sentence each).
   - Four cells:
     - Loan view: Collateral (BTC, "≈ … MUSD"), Collateral ratio ("liquidated below 110% · Mezo suggests 150% or more"), Liquidation price ("BTC would have to fall N%" and "rises ≈ M a year from interest"), Borrowing room ("keeps CR ≥ 160%").
     - Multiply view: BTC exposure ("K× your net value"), Debt ("1% a year"), Liquidation price ("BTC would have to fall N%"), Collateral ratio ("Mezo suggests 150% or more").
   - Headline: Loan view "Total debt" (debt, "includes X MUSD interest · R% a year"); Multiply view "Net value" in BTC ("≈ … MUSD · collateral minus debt").
   - Footer line: "BTC P MUSD from Mezo's oracle · block B · Refresh", and the liquidation-risk thresholds.
4. Main column: **Change your Trove** card (rows with a sentence and a secondary button each: Unwind, Leverage ("down to the ratio you choose, never below 200%": `LEVERAGE_CR_FLOOR`), Close → the existing flow pages; "Add collateral, borrow, or repay" → Mezo app, external). Then **If BTC moves**: the CR line over `MOVES` with the risk levels as bands (liquidation below the MCR, High up to ≈ 157.1%, Medium up to ≈ 203.7%), "Show figures" table as the accessible source (existing `BtcMoveChart` pattern).
5. Aside: **Redemption queue** (debt ahead and its share, place N of M, the existing explainer), **Borrowing** (interest rate, borrowing fee, the 200 MUSD gas deposit), **Mezo now** (system ratio, Recovery Mode on/off "starts below 150%", open Troves).

Formulas (all on the snapshot's price, rounding never flatters the Trove):
- Liquidation drop: `1 − liquidationPrice / price`, rounded **down** to whole percent; liquidation price itself rounds up (existing).
- Interest drift: `principal × interestRateBps / 10_000 × mcr / coll` per year, rounded up; hidden when the rate or principal is 0.
- Net value: `coll × price − debt` (MUSD), shown in BTC as `/ price`; leverage `coll × price / net value`, one decimal place, "—" when net value ≤ 0.
- Borrowing room: today's `borrowHeadroom` maths applied to the Trove snapshot.

The view switch changes no data; it is remembered per browser (`localStorage`, `mezoroute.trove-view`, `"multiply"` means Multiply, anything else Loan, every read/write in try/catch). Default Loan.

## 5. Page without a Trove, or without a wallet

1. `h1` "Trove", subtitle "A Trove is a MUSD loan on Mezo, backed by BTC you lock in it. MezoRoute can open one with leverage, and later unwind, leverage, or close it, each in one transaction."
2. Claim surplus BTC notice if the wallet has surplus (a redemption or liquidation closed its Trove).
3. **Open a Trove** card: three facts read live (minimum debt = `MIN_NET_DEBT` + `GAS_COMPENSATION` = 2,000 MUSD, "1,800 borrowed + 200 MUSD gas deposit, returned on close"; collateral ratio "110% min · Mezo suggests 150% or more; MezoRoute's Open and Leverage keep 200% or more" (`LEVERAGE_CR_FLOOR`; 160% applies only to borrowing room and Borrow & Deploy); cost "R% a year, plus a F% borrowing fee", where R is the rate a new Trove gets: `InterestRateManager.interestRate()` (bps), a new read in the Trove snapshot from a new `NetworkConfig.addresses.interestRateManager` (testnet `0xD4D6c36A592A2c5e86035A6bca1d57747a567f37`, mainnet `0x4a453700d157717Fe02fB62E7700ED7845048285`, both from `TroveManager.interestRateManager()`, both 100 bps on 13 Nov). Buttons: primary **Open with leverage** (`/trove/open/`), secondary **Open in the Mezo app** (external). Without a wallet the primary is **Connect** (the planners' pattern) and Open with leverage is secondary. A warning notice: Open with leverage needs ≥ 2,000 MUSD of debt, so about X BTC of the user's own (the smallest open: 2,000 MUSD of debt at the 200% floor, from the existing `quote-open` maths, not a hand formula), and on mainnet `MAINNET_NOT_RUN` with the caps.
4. **What MezoRoute does with a Trove**: four numbered rows (Open with leverage, Leverage, Unwind, Close), one sentence each.
5. **Two risks to know**: Liquidation and Redemption in plain words (copy in the mockup).
6. Aside: **Mezo now** (system ratio, Recovery Mode, open Troves, BTC price with "Mezo's oracle · block B"), **Before you sign** (Leverage contract address with explorer link, 10 bps on Open and Leverage, 2 signatures: Trove authorisation and permit, link to Proof).

No wallet: `useTroveSnapshot` reads with the zero address, as `useSpSnapshot`/`useDashboardSnapshot` do since U17; nothing is shown as the visitor's. The builder checks each read in `troveSnapshotContracts` against the zero address on both networks (the BTC precompile reverts some calls on 0x0, see U13's `allowance`), and tolerates exactly the reads that need it.

## 6. Dashboard card and navigation

- `TroveCard` with a Trove: both risk levels, Collateral ratio, Debt, Liquidation price ("BTC −N%"), and a secondary "Manage Trove →" to `/trove/`. Without a Trove: "No open Trove. MezoRoute can open one with leverage in one transaction." and "See Trove →".
- The Unwind/Close/Leverage buttons and the redemption queue line move to `/trove/`. The surplus claim and the Recovery Mode repay notices stay on the Dashboard card too (they need action now), so `TroveActions` splits into notices (both places) and actions (`/trove/` only).
- Header `NAV`: Dashboard · Positions · **Trove** · Proof. Trove hides below 768 px like Proof (`navHideClass` → `max-md:hidden`); `onMobile` shows Dashboard on `/trove/` and never Trove. Re-check the header from 640 to 1024 px for overflow (U19 found one at 640–686 px).
- Footer: a Trove link next to Proof, at every width.
- `app/trove/page.tsx` + `app/trove/layout.tsx` with `pageMetadata("/trove/")` (a new entry in `src/lib/seo/pages.ts`). A layout at `app/trove/` wraps the existing flow routes: their own layouts keep absolute titles and repeat `SITE_OPEN_GRAPH` (U14 rule), and `check-metadata` must still pass.
- `layout.test.ts` must cover the new page (it frames with `Column`).

## 7. Constraints

- Everything in AGENTS.md and `frontend/DESIGN.md` applies: one `h1`, `Card` levels, `Segmented` as the only radiogroup, `Notice` tones, `Term` on the first naming of a Mezo term (not inside buttons or tabs), Geist Mono, token colours only (risk dots use existing tone tokens: low = `positive`/success, medium = warning, high and liquidatable = danger), `motion-safe:`, the guard tests.
- Reads stay on the selected network (the app's network switch), unlike Proof.
- Copy is English; the user is replied to in Vietnamese.
- TDD for every pure function: `liquidationRisk`, `redemptionRisk`, `liquidationDrop`, `interestDrift`, `multiplyView`, nav helpers. The live QA follows AGENTS.md (served `frontend/out`, Playwright, mock wallet on the QA accounts: testnet with a Trove `0xe618B9B519Ee71a7e38D6f0c2e9479c573600D56`, at risk `0xDA04759E54728B6636Fe48F7c9795c7B609bAaAa`, no Trove `0xe37c0e20cf9f466e869a9e20ffbe66333b8f6b74`; mainnet no Trove; no wallet).

## 8. Deferred

- Redemption history notice (research point 5): count `Redemption`-related events touching the Trove since its last owner action, Liquity-style. Needs an explorer log scan per Trove; recorded in STATUS as a later item.

## 9. Left to the builder

- Component split and file names (follow existing patterns: pure maths in `src/lib/trove/` or `src/lib/leverage/`, views in `src/components/trove/`).
- Exact layout of the risk row at 375 px, as long as both levels and the four cells stay readable without horizontal scroll.
- Whether the chart reuses `chartPlots` or a new CR-only plot helper built from the Trove snapshot.
