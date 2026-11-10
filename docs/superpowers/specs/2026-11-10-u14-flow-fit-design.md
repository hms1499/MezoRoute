# U14: Every flow at page width, and six product fixes (design)

Date: 10 Nov 2026 · Branch: `feat/u14-flow-fit` (from `main` at `d07f459`, which carries `fix/flow-left-edge`)

## Why

The 10 Nov review rated the app a good beta. Two problems keep it from feeling finished.

First, the app has two page grammars. Since `b94cb1d`, the LP Amount page fills the page width in Positions' grid. Every other flow page (LP Confirm, the Stability Pool and Trove amount and confirm pages, LP exit, Stability Pool withdraw, the receipt) is a 520 px centred column. At 1440 px the left edge jumps from 168 px to 460 px when the user presses Review on LP. Moving between the Dashboard and any flow, the page changes shape. The user chose one grammar for all of them (10 Nov): every flow page is two columns at the page width of Dashboard and Positions.

Second, the review found six faults a real user hits on the first try:

1. Leverage says the Trove is too low when it is not.
2. The primary action sits below the fold.
3. Amount errors appear far from the field.
4. The 404 page is Next.js's default.
5. Every page has the same title, and none has a share card.
6. Withdrawing from the Stability Pool with no deposit shows a dead form.

This spec does both. It changes no contract, quote, gate rule, or transaction payload.

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

- **A.** Every page has one width and one left edge: the shell's 1104 px content box. Flow pages use Positions' grid, with the working card at two thirds and an aside at one third from `lg`, and one column below. The full risk list stays visible before signing at every width.
- **B1.** When Leverage has no room, the page says what stops it, from the same `limitedBy` the non-zero cases use, and offers a way forward.
- **B2.** At 1440×1000, the primary action of every amount and confirm page is fully above the fold with the mainnet banner shown, for the default state QA uses.
- **B3.** An amount that the user's balance or the pool cannot take marks the field itself (`aria-invalid` plus a message under it). A heavy price impact is visibly a warning before it becomes a block.
- **B4.** An unknown URL shows a MezoRoute page with the app's shell, one h1, and ways back.
- **B5.** Every route has its own title, and the exported HTML carries Open Graph and Twitter cards.
- **B6.** The Stability Pool withdraw page with no deposit and no gain is an empty state that leads to a deposit.

## Non-goals

- New data reads for the asides. Every aside shows what the page's snapshot already holds. No aside adds a multicall or a history scan.
- A comparison card on the Stability Pool amount page. The LP rate is not in its snapshot.
- Changing what any card does: its inputs, gate, steps, and copy stay, except where B1–B6 say otherwise or a block moves to the aside.
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
- any page's left edge differs from the Dashboard's at the same width;
- a flow route ships without an aside from `lg` (except its loading, error, and connect states, which keep the right column empty so the card's edge and width hold);
- a fact appears in both the card and the aside on the same screen.

## Design

### A. Every flow at page width

**One width.** The 520 px flow column is retired. `FlowColumn` always renders Positions' grid: header across the top, then `grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start`, with the children in `lg:col-span-2` and the aside in the third column. With no aside (loading, error, connect, `NoExecutorCard`), the third column stays empty, so the card keeps its edge and width when the data arrive.

- `isFlowPath`, `WIDE_ROUTES`, `FLOW_WIDTH`, and `FlowPage` are deleted.
- Every `page.tsx` frames with `Column`.
- `AppShell`'s banner always spans the page.
- `layout.test.ts` becomes: every `app/**/page.tsx` uses `Column` (or its own layout, for `/`), and none imports `FlowPage` or writes `max-w-[520px]`.
- DESIGN.md's Layout section goes from "two page widths" to one.

**One fact panel.** `BeforeYouSign` becomes generic: `BeforeYouSign({ rows })`. The rows come from pure helpers in `src/lib/flow/sign-facts.ts`, each tested, and every helper ends with Audit and Reads (the block):

| Helper | Rows |
| --- | --- |
| `lpSignFacts` | Executor (explorer link), MezoRoute fee, Entry cap, Audit, Reads. These are today's rows. Exit uses the same helper and replaces Entry cap with "LP permit, or exact approval for a smart account". |
| `spSignFacts` | Contract: the Stability Pool (explorer link). MezoRoute fee: none. Approval: exact amount. Audit: "Mezo's contract; MezoRoute adds none". Reads. |
| `troveSignFacts` | Contract: `MezoRouteLeverage` (explorer link), or BorrowerOperations for Open, Repay, and Claim surplus. MezoRoute fee. Per-transaction caps. Signatures: Trove authorisation and permit, from the plan's steps. Audit. Reads. |

**Risks on Confirm.** `ConfirmCard` takes `risksPlacement: "card" | "aside-from-lg"`. All three Confirm components (LP, Stability Pool, Trove) pass `"aside-from-lg"`.

- The card's risk section is `lg:hidden`, and the aside's copy is `hidden lg:block`.
- Below `lg` the risks stay in the card above the steps, as today. Only one copy is ever displayed, and `display: none` keeps the other out of the accessibility tree.
- From `lg`, the card's `Overview` groups take two columns (`columns={2}`: You pay and Terms left, You receive right, or the Trove's groups in the same order). `Overview` defaults to one column.

**What each page puts in the aside** (top to bottom; below `lg` the aside stacks under the card):

| Page | Card (two thirds) | Aside (one third) |
| --- | --- | --- |
| LP Amount `/route/lp/` | unchanged, plus B2's changes | Compare with the Stability Pool (deposit mode), Before you sign (`lpSignFacts`). This is today's aside. |
| LP Confirm `/route/lp/confirm/` | overview (two columns), quote, steps, footnote | Risks (from `lg`), Before you sign (`lpSignFacts`) |
| SP Amount `/route/stability-pool/` | the entry card | Your deposit (deposit, BTC gain, from the snapshot; hidden when both are 0), Before you sign (`spSignFacts`) |
| SP Confirm `/route/stability-pool/confirm/` | overview, steps | Risks (from `lg`), Before you sign (`spSignFacts`) |
| Trove Amount `/trove/{open,leverage,unwind,close}/` | the action card, without the Redemption queue block | Your Trove now (collateral, debt, CR, liquidation price; Open: "No Trove yet" and the BTC balance), the Redemption queue (`QueueLine`, moved out of the card), Before you sign (`troveSignFacts`) |
| Trove Confirm `/trove/*/confirm/` | overview (two columns), steps | Risks (from `lg`), the Redemption queue after, Before you sign (`troveSignFacts`) |
| LP exit `/positions/lp/exit/` | the exit card with its steps | Your position (wallet LP, staked LP, claimable fees: `LpDetails` rows), Before you sign (`lpSignFacts`, exit variant) |
| SP withdraw `/positions/stability-pool/withdraw/` | the withdraw card, or B6's empty card | Your deposit (`SpDetails` rows) when there is one, Before you sign (`spSignFacts`) |
| Receipt `/tx/` | what happened: the outcome, the amounts moved, the next action | Transaction: hash (explorer link), block, gas used, network fee (whatever the receipt already reads). These rows leave the card. Then Next: links to Positions and the Dashboard. |
| Connect (`ConnectPage`), loading, error | the card | empty |

The Trove Amount card loses its 166 px Redemption block to the aside, which also serves B2. The queue explanation already appears on the Dashboard. In the aside it sits once per screen, never in both places.

**Mobile.** Below `lg`, every page is one column: header, card, then the aside's panels. Nothing moves above the card. Confirm's risks stay inside the card before the steps.

**Expected result at 1440×1000:**

- Every flow page's banner, h1, and card start at 168 px, like Dashboard and Positions.
- The card spans 168–899 and the aside 915–1272, as LP Amount measured on `b94cb1d`.
- LP Confirm's Sign moves from 1253 px to about 840 px: the risks (216 px) go to the aside, and the two-column overview saves about 200 px.

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

**Confirm pages and Trove Amount** get their fix from A: the risks and the Redemption queue move to the aside, and the overview splits into two columns.

**Guard:** a Playwright check in QA, not in `npm test`. At 1440×1000 on mainnet with the banner, the bottom of the primary is at most 1000 px on every amount and confirm page in its QA state (the table under Testing and QA). A page that still misses after A and B2 is reported to the user with its measured position before the branch merges. Its fix is not invented in the plan.

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

- **`deposit === 0n` and `gain === 0n`:** the page keeps its header and the grid (Before you sign in the aside) (back to Positions, the h1 with its `Term`) and shows one card in the flow column, using the empty-state grammar of the Positions empty state (U13 follow-up: heading, sentence, no decorative glyph). The heading is "No Stability Pool deposit". The sentence is "Deposit MUSD to the Stability Pool first. You can withdraw it, and any BTC it earns, here afterwards." It has one primary `ButtonLink`, "Deposit to the Stability Pool", to `/route/stability-pool/`, and a secondary "Back to Positions". The red notice, the 0 rows, and the disabled Withdraw are gone.
- **`deposit === 0n` and `gain > 0n`:** the same card says "Your deposit is fully withdrawn. A BTC gain of X is still waiting." Its primary is "Claim BTC gain" (the existing claim action, now the primary, not secondary).
- **`deposit > 0n`:** unchanged.

A pure `spWithdrawState(deposit, gain): "empty" | "gain-only" | "form"` in `src/lib/stability-pool/` decides, and is tested.

## Files (expected)

| Area | Files |
| --- | --- |
| One width | `src/lib/ui/layout.ts` (deleted or reduced), `layout.test.ts`, every flow `src/app/**/page.tsx`, `src/components/AppShell.tsx`, `src/components/flow/{FlowColumn,FlowPage (deleted),ConfirmCard,Overview}.tsx`, `card.test.ts`, `confirm.test.ts` |
| Asides | `src/components/lp/BeforeYouSign.tsx` (generic, moves to `components/flow/`), `src/lib/flow/sign-facts.ts` (new) and test, `LpConfirmPage`, `SpRoutePage`, `SpConfirmPage`, `SpWithdrawPage`, `TrovePages`, `TroveViews`, `ExitPage`, `ReceiptPage`, `ReceiptCard`, `ConnectPage` |
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
  - **A:** left edges of the banner, h1, card, and aside on all 19 pages at 360, 390, 768, 1024, 1440, and 1920. Every page shows the same numbers as the Dashboard at each width, and nothing scrolls horizontally. Below 1024, each Confirm page shows its risks before Sign. QA states:
  - LP Amount and LP Confirm: MAIN on mainnet.
  - SP Amount, SP Confirm, and SP withdraw: MAIN, plus EMPTY for the empty state.
  - Trove Amount and Confirm: BORROWER on testnet, and MAIN on mainnet for Close.
  - Open: EMPTY on testnet.
  - LP exit: MAIN.
  - Receipt: the recorded mainnet hash in STATUS.
  - **B1:** BORROWER on testnet Leverage shows the oracle sentence (while the testnet pool stays more than 5% off).
  - **B2:** primary bottom ≤ 1000 px at 1440×1000 on every amount and confirm page in the states above.
  - **B3:** `/route/lp/?amount=999999` with BORROWER shows the message under the field and `aria-invalid="true"`. A 2% impact reads amber.
  - **B4:** `/nope/` shows the header, the h1, and both links in both themes.
  - **B5:** the titles of 5 routes and `og:image` in the exported HTML.
  - **B6:** EMPTY on withdraw sees the empty card. An account with deposit 0 and gain > 0 (if one exists on testnet; otherwise a unit test only) sees Claim as the primary.
- Screenshots: viewport shots of the changed pages only (light and dark at 390 and 1440), for the user's local check. No ui-audit run.

## Decisions taken (senior calls)

- **One page width for everything (the user's call, 10 Nov).** The 520 px column, `FlowPage`, and `isFlowPath` go. Each flow gets an aside built from data its page already reads.
- **Risks in the aside from `lg`, in the card below it.** This is the only layout that shortens Confirm on desktop without putting a risk after Sign on mobile.
- **The receipt's technical rows go to the aside.** The card answers "what happened" and the aside "which transaction". This also starts on the review's "13 raw rows" polish item, without the rest of the polish list.
- **Staking becomes an overview row, not a removed feature.** It deletes a duplicate row and is the biggest single height cut.
- **No stepper for SP withdraw.** It is one transaction, as stated under Non-goals.
- **One Open Graph image.** Per-page images add build complexity for little gain at this stage.
