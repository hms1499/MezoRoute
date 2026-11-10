# U14: LP Confirm at page width and six product fixes (design)

Date: 10 Nov 2026 · Branch: `feat/u14-flow-fit` (from `main` at `d07f459`, which carries `fix/flow-left-edge`)

## Why

The 10 Nov review rated the app a good beta. Two problems keep it from feeling finished.

First, the LP flow is not one page grammar. Since `b94cb1d`, the LP Amount page fills the page width in Positions' grid. LP Confirm is still a 520 px centred column, so the left edge jumps from 168 px to 460 px at 1440 px when the user presses Review.

Second, the review found six faults a real user hits on the first try:

1. Leverage says the Trove is too low when it is not.
2. The primary action sits below the fold.
3. Amount errors appear far from the field.
4. The 404 page is Next.js's default.
5. Every page has the same title, and none has a share card.
6. Withdrawing from the Stability Pool with no deposit shows a dead form.

This spec fixes all seven. It changes no contract, quote, gate rule, or transaction payload.

## Evidence (measured 10 Nov on the `main` build, keyless mock wallet, Playwright at 1440×1000)

| Page | Account | What was measured |
| --- | --- | --- |
| `/route/lp/?amount=10` (mainnet) | MAIN | Card starts at 317 px. Review runs from 1099 px to 1143 px, below the 1000 px fold. The stake block is 154 px tall (toggle plus an 88 px paragraph), and the overview has its own Staking row as well. |
| `/route/lp/confirm/?amount=10` (mainnet) | MAIN | Sign starts at 1253 px. The overview is 501 px (You pay 113, You receive 219, Terms 167), the risk list 200 px, the steps 248 px. |
| `/route/lp/?amount=999999` (testnet) | BORROWER, 0 MUSD | The field sits at 404 px and "Amount exceeds your available MUSD." at 1001 px, about 600 px apart. The field has no `aria-invalid`. |
| `/trove/leverage/` (testnet) | BORROWER, CR 306.3% | Shows "Your Trove is already at or below 200%: there is no room to leverage." |
| `/positions/stability-pool/withdraw/?percent=50` (testnet) | EMPTY | Shows the full form with 0 MUSD in every row, a red "You have no Stability Pool deposit.", and a disabled Withdraw. |
| `/nope/` | none | Title is "404: This page could not be found."; body is Next's default page. Every other page's title is "MezoRoute". |

Root cause of fault 1, from a read-only script against testnet (`leverageMax` inputs for BORROWER):

- `floor` allows 0.0307 BTC.
- `capacity` allows 0.0545 BTC.
- `cap` allows 12 BTC.
- `oracle` allows 0 BTC. At the smallest size, buying BTC costs 504 bps against the oracle: the pool prices BTC at about 78,500 MUSD and the oracle at 74,764. The app's bound is 500 bps.

So `limitedBy` is `"oracle"`. `leverageMaxNote` returns the floor sentence for any zero (`view.ts:125`) and never reads `limitedBy`.

## Goals

- **A.** LP Amount and LP Confirm share one page grammar: the same width, the same left edge, and Positions' grid. The full risk list stays visible before signing at every width.
- **B1.** When Leverage has no room, the page says what stops it, from the same `limitedBy` the non-zero cases use, and offers a way forward.
- **B2.** At 1440×1000, the primary action of LP Amount and LP Confirm is fully above the fold with the mainnet banner shown.
- **B3.** An amount that the user's balance or the pool cannot take marks the field itself (`aria-invalid` plus a message under it). A heavy price impact is visibly a warning before it becomes a block.
- **B4.** An unknown URL shows a MezoRoute page with the app's shell, one h1, and ways back.
- **B5.** Every route has its own title, and the exported HTML carries Open Graph and Twitter cards.
- **B6.** The Stability Pool withdraw page with no deposit and no gain is an empty state that leads to a deposit.

## Non-goals

- Making the Stability Pool, Trove, exit, or withdraw Confirm pages wide. They have no aside, and their flows stay 520 px columns.
- Moving the receipt (`/tx/`). It stays one centred card: a single result with no aside. That the left edge moves on the Done step is accepted and written down in DESIGN.md.
- Changing the oracle bound (500 bps), the price-impact limit (5%), `PRICE_IMPACT_LIMIT`, or any gate order.
- The review's polish list (table unit wrapping, landing illustrations, number formats, receipt rows, duplicated content, the RainbowKit modal copy). It is the next branch.
- A stepper on Stability Pool withdraw. It is one transaction, and `Button`'s `pending` already shows wallet, confirming, and done. A one-item `StepList` would add chrome without information.
- Per-page Open Graph images. One shared card is enough for now.

## Anti-goals

The design fails, even if it builds, if:

- below 1024 px, a risk appears after the Sign button;
- a page has two accent buttons;
- the Staking control and a separate Staking row both appear in the LP card;
- a Leverage zero still names the floor when the floor is not what binds;
- a price impact over 5% reads in the neutral colour;
- `<title>` comes from client JavaScript (share crawlers do not run it);
- a flow route outside `WIDE_ROUTES` loses its 520 px frame (`layout.test.ts` must keep passing).

## Design

### A. LP Confirm at page width

`/route/lp/confirm/` joins `WIDE_ROUTES` in `src/lib/ui/layout.ts`. Its `page.tsx` frames with `Column` instead of `FlowPage`, so the banner spans the page and `layout.test.ts` keeps holding.

`LpConfirmPage` passes an `aside` to `FlowColumn`. From `lg` this gives the same grid as Amount: the card takes two thirds, the aside one third. The aside holds:

1. **Risks:** the full `entryRisks(...)` list, under the same `h3` (warning icon, "Risks").
2. **`BeforeYouSign`:** the executor address, permit, fee, and cap, the same component Amount uses.

The `ConfirmCard` keeps the overview, the quote block, the steps, and the footnote. It gets a `risksPlacement: "card" | "aside-from-lg"` prop. With `"aside-from-lg"` the card's risk section is `lg:hidden`, and the aside's copy is `hidden lg:block`. Below `lg` the risks therefore stay in the card above the steps, as they do today, and the aside (Before you sign only) stacks under the card. Exactly one copy is ever displayed, and `display: none` keeps the other out of the accessibility tree.

The other Confirm pages pass nothing and keep `"card"`.

From `lg`, `Overview`'s groups lay out in two columns inside the wide card. You pay and Terms go on the left, You receive on the right. The rows already carry `group` (U13), so this is a grid on the group wrappers: `lg:grid-cols-2`, one column below. This applies only when the card is wide: `ConfirmCard` passes `columns={2}` for `"aside-from-lg"`, and `Overview` defaults to one column.

Every state the route renders (loading, error, the `RequireWallet` connect, `NoExecutorCard`) is drawn in the two-thirds column. Today they would span the page. A `FlowColumn` aside layout with an empty aside keeps them on the card's left edge and width.

Expected result at 1440×1000: the card and aside start at 168 px like Amount. Sign starts near 1253 − 216 (risks moved) − about 200 (two-column overview), which is about 840 px.

### B1. Leverage with no room

`leverageMaxNote` returns a sentence per `limitedBy` for the zero case too:

| `limitedBy` at zero | Sentence | Page action |
| --- | --- | --- |
| `floor` | "Your Trove is already at or below 200%: there is no room to leverage." (today's) | none |
| `oracle` | "The pool's BTC price is more than 5% above Mezo's oracle, so leverage would overpay for BTC. Try again when the pool is back within 5%." | none (no route around the bound) |
| `capacity` | "Your Trove has no borrowing capacity left, even after a refinance." | none |
| `cap` | Cannot be zero with a positive cap. Kept as a fallback that names the cap. | none |

The `oracle` sentence names the pool's measured cost when the page has it: "…about 5.0% above…", from `oracleCostBps` at the smallest size, rounded to 0.1%. The existing `ORACLE_BOUND_DEFAULT_BPS` supplies the 5%.

While `max.btc === 0n`, the target-CR presets and input are disabled with that sentence as their description. The page shows no disabled Review: there is no action to take here, and the header's existing "Dashboard" back link is the way out. The Unwind and Close actions on the Dashboard's Trove card are untouched.

Tests (`view.test.ts`): one case per `limitedBy` at zero, plus the BORROWER live shape (floor 0.0307, capacity 0.0545, cap 12, oracle 0 → `oracle` sentence).

### B2. The primary above the fold

**LP Amount** needs to gain about 150 px.

- **The Staking row becomes the control** (about −170 px). The separate stake block goes. The overview's Staking row carries the switch on its value side (`role="switch"`, label "Stake for MEZO"). Its sub-line stays "swap fees go to veBTC voters", as the staking copy rule requires. The 88 px explanation moves to a `Term` on the row label ("Staking" gets a glossary entry: the LP sits in the pool's gauge, which pays MEZO and leaves swap fees to veBTC voters) and to the Details panel, which already explains the gauge.
  - `between-weeks`: the row shows the switch, and the sub-line says the next rate is not set yet.
  - `unavailable`: the row is absent, as today.
  - A failed gauge read: the row keeps its "Rates unavailable" sub-line from `StakeToggle`.
- **The mode tabs drop their description line** (about −24 px). "Borrow MUSD from your Trove…" moves to the Borrow & Deploy panel's first line, where `Term` already lives.
- **`PageHeader` puts the back link and the progress on one row from `sm`** (about −30 px). The back link goes left and the progress right. Below `sm` they stay stacked.

**LP Confirm** gets its fix from A.

**Guard:** a Playwright check in QA, not in `npm test`. At 1440×1000 on mainnet with the banner, the bottom of the primary is at most 1000 px on LP Amount (deposit, connected, amount 10) and on LP Confirm (amount 10). QA also records the primary's position on every other amount and confirm page and reports any that fall below the fold. Fixing those is out of scope unless one of the levers above already fixes it.

### B3. Errors at the field

`EntryBlockReason`s caused by the typed amount surface on the field: `TokenAmountInput`'s existing `error` prop, which sets `aria-invalid` and renders the message under the field with the alert icon. The reasons are `insufficient-balance`, `above-cap`, `too-small`, `price-impact`, and `above-headroom`. A pure helper, `fieldError(block): string | null` in `src/lib/flow/`, maps them.

`BlockNotice` stops repeating those reasons. Their recovery actions (Use my balance, Borrow & Deploy instead, the Mezo app) stay where they are: the first recovery stays the page's one primary (U12). Reasons that are not about the amount (`wrong-network`, `needs-gas`, `recovery-mode`, …) stay in `BlockNotice`.

The same mapping applies to the Stability Pool deposit card and the Trove amount inputs where their gates have the equivalent reasons. Each page's helper is tested. The plan lists which reasons each gate has.

**Price impact tone:**

- `Overview` gets one new tone, `warning`, which renders `text-warning-ink`. DESIGN.md's `positive`/`negative` rule stays for signed results. `colour-roles` and `design-doc` are updated to allow it.
- The LP price-impact row is `warning` from 1% (`PRICE_IMPACT_WARN`, new, next to `PRICE_IMPACT_LIMIT`).
- Above the 5% limit, the field error says "Price impact above 5%: try a smaller amount."

### B4. A MezoRoute 404

`src/app/not-found.tsx` is a server component rendered inside the root layout, so it gets the header, footer, and theme. The static export writes it to `404.html`, which Vercel serves.

It uses `Column`. The content is:

- An h1: "Page not found".
- One sentence: "This address is not part of MezoRoute. Check the link, or go to one of these pages."
- Two `ButtonLink`s: "Open the dashboard" (primary, to `/`) and "Positions" (secondary).

The metadata title is "Page not found". `layout.test.ts`'s route walk ignores `not-found.tsx` (it is not a `page.tsx`). A test asserts that it uses no `FlowPage`.

### B5. Titles and share cards

The root `metadata` gets:

```ts
title: { default: "MezoRoute", template: "%s | MezoRoute" },
metadataBase: new URL("https://mezoroute.vercel.app"),
openGraph: { siteName: "MezoRoute", type: "website", images: ["/og.png"] },
twitter: { card: "summary_large_image" },
```

Each `page.tsx` is a client module (it imports with `ssr: false`), so it cannot export metadata. Each route segment gets a server `layout.tsx` that only re-exports metadata, with `export const metadata = pageMetadata("/route/lp/");` and `children` passed through.

`src/lib/seo/pages.ts` holds one map from route to `{ title, description }`. Examples:

- `/`: the root layout's default, "MezoRoute" (it is the landing before a wallet connects and the Dashboard after, so it gets no segment layout)
- `/positions/`: "Positions"
- `/route/lp/`: "Add liquidity"
- `/route/lp/confirm/`: "Review your deposit"
- `/trove/leverage/`: "Leverage your Trove"
- `/tx/`: "Transaction"

The map's titles match each page's h1 where the h1 is static. `pageMetadata` also fills `openGraph.title` and `openGraph.description`.

Confirm pages and `/tx/` add `robots: { index: false }`, because their URLs carry an amount or a hash.

`/og.png`, 1200×630, lives in `public/`. It is built once from the brand icon and the light palette, with the wordmark and one line ("Put your MUSD to work on Mezo, and see what each route does to your BTC risk."). It is rendered from a small HTML file with Playwright at 1200×630; that source sits in `brand/og/` next to the PNG so it can be rebuilt. Light is used because share previews sit on white more often than dark.

Guard (`src/lib/seo/pages.test.ts`):

- Every `app/**/page.tsx` except the root has an entry in the map and a sibling `layout.tsx` that calls `pageMetadata` with its own route.
- No two routes share a title.
- No title contains "MezoRoute" (the template adds it).
- The built `out/route/lp/index.html` contains `<title>Add liquidity | MezoRoute</title>` and `og:image`. This is checked by a `postbuild` grep next to the relayer check, so `npm test` stays build-free.

### B6. Stability Pool withdraw with nothing to withdraw

`SpWithdrawPage` handles a `deposit === 0n` case before the form:

- **`deposit === 0n` and `gain === 0n`:** the page keeps its header (back to Positions, the h1 with its `Term`) and shows one card in the flow column, using the empty-state grammar of the Positions empty state (U13 follow-up: heading, sentence, no decorative glyph). The heading is "No Stability Pool deposit". The sentence is "Deposit MUSD to the Stability Pool first. You can withdraw it, and any BTC it earns, here afterwards." It has one primary `ButtonLink`, "Deposit to the Stability Pool", to `/route/stability-pool/`, and a secondary "Back to Positions". The red notice, the 0 rows, and the disabled Withdraw are gone.
- **`deposit === 0n` and `gain > 0n`:** the same card says "Your deposit is fully withdrawn. A BTC gain of X is still waiting." Its primary is "Claim BTC gain" (the existing claim action, now the primary, not secondary).
- **`deposit > 0n`:** unchanged.

A pure `spWithdrawState(deposit, gain): "empty" | "gain-only" | "form"` in `src/lib/stability-pool/` decides, and is tested.

## Files (expected)

| Area | Files |
| --- | --- |
| Layout and wide confirm | `src/lib/ui/layout.ts`, `layout.test.ts`, `src/app/route/lp/confirm/page.tsx`, `src/components/flow/{FlowColumn,ConfirmCard,Overview}.tsx`, `card.test.ts`, `confirm.test.ts`, `src/components/lp/LpConfirmPage.tsx` |
| Leverage | `src/lib/leverage/view.ts`, `view.test.ts`, `src/components/trove/TrovePages.tsx` |
| Fold | `src/components/lp/{LpEntryCard,LpRoutePage,StakeToggle,ModeToggle}.tsx`, `src/components/ui/PageHeader.tsx`, `src/lib/glossary.ts` |
| Field errors | `src/lib/flow/field-error.ts` (new) and test, `src/components/lp/BlockNotice.tsx`, `src/components/flow/{TokenAmountInput,Overview}.tsx`, `src/lib/routes/musd-btc-lp/gate.ts` (`PRICE_IMPACT_WARN`), the SP and Trove amount cards |
| 404 | `src/app/not-found.tsx` (new) |
| SEO | `src/app/layout.tsx`, `src/app/**/layout.tsx` (new, one per route), `src/lib/seo/pages.ts` and test, `public/og.png`, `scripts/` postbuild check |
| SP withdraw | `src/components/stability-pool/SpWithdrawPage.tsx`, `src/lib/stability-pool/withdraw-state.ts` and test |
| Docs | `frontend/DESIGN.md` (two page widths: LP Amount and Confirm are wide; receipt stays centred; `warning` tone in Overview; Staking as an overview control), `AGENTS.md` (U14 line), `docs/STATUS.md` |

## Testing and QA

- TDD per part. `npm test` and `npm run build` must pass, including every existing guard (`layout`, `colour-roles`, `design-doc`, `typography`, `heading-guard`, `control-guard`).
- Mock-wallet QA (Playwright, the keyless EIP-1193 mock, the QA accounts in STATUS):
  - **A:** left edges of the banner, h1, card, and aside on LP Amount and LP Confirm at 390, 1024, 1440, and 1920 (same numbers on both pages). Below 1024, the risks come before Sign.
  - **B1:** BORROWER on testnet Leverage shows the oracle sentence (while the testnet pool stays more than 5% off).
  - **B2:** primary bottom ≤ 1000 px at 1440×1000 on LP Amount and LP Confirm (mainnet, MAIN). Report every other amount or confirm page's primary position.
  - **B3:** `/route/lp/?amount=999999` with BORROWER shows the message under the field and `aria-invalid="true"`. A 2% impact reads amber.
  - **B4:** `/nope/` shows the header, the h1, and both links in both themes.
  - **B5:** the titles of 5 routes and `og:image` in the exported HTML.
  - **B6:** EMPTY on withdraw sees the empty card. An account with deposit 0 and gain > 0 (if one exists on testnet; otherwise a unit test only) sees Claim as the primary.
- Screenshots: viewport shots of the changed pages only (light and dark at 390 and 1440), for the user's local check. No ui-audit run.

## Decisions taken (senior calls)

- **Risks in the aside from `lg`, in the card below it.** This is the only layout that shortens Confirm on desktop without putting a risk after Sign on mobile.
- **Staking becomes an overview row, not a removed feature.** It deletes a duplicate row and is the biggest single height cut.
- **No stepper for SP withdraw.** It is one transaction, as stated under Non-goals.
- **One Open Graph image.** Per-page images add build complexity for little gain at this stage.
