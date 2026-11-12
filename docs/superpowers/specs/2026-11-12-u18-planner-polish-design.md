# U18: Planner polish (design)

Date: 12 Nov 2026 · Branch: `feat/u18-planner-polish` (from `main` at `d03686e`) · Source: a product-design review of the two planners on 12 Nov 2026 (Playwright, no wallet, testnet, 1440 and 375 px), whose findings 1, 2, 4, 5, 6 and 7 the user asked to build together as one small pass, approved in chat.

## Why

U13 and U17 made both planners (`/route/lp/`, `/route/stability-pool/`) usable without a wallet and put risk first. The review found the structure sound and the detail layer uneven:

1. **Numbers read differently from row to row.** The field shows `1000` while every other figure is grouped (`1,000`). MUSD shows 2 decimals in the aside and 4 in the card (`961.077`, `499.4012`); the Staking row says `144.0331 MEZO` while the header and aside say `144.03`.
2. **One fact, several framings.** "MEZO a week" appears three times (card header, Staking row, aside). A 30% BTC fall is a loss in the card (`If BTC −30%: ≈ −195.9052 MUSD`) and a remaining value in the aside (`≈ 804.09 MUSD`), so the reader has to subtract to see they agree. The header also changes meaning when an amount is typed (empty: `Pool · 0.04% swap fee`; 1,000: `At this week's rate · ≈ 144.03 MEZO a week`), and with Staking on the empty state names a swap fee the staked deposit will not receive.
3. **A bug in the LP planner's empty state.** With nothing typed, the aside compares the labelled 1,000 MUSD example but says "This week's rate unavailable". `LpRoutePage` passes `lpWeekRate` the card's own quote (`quote?.liquidity ?? null`), which is null without an amount; `SpRoutePage` already passes `plannerLpFigures(...).liquidity` and shows the rate.
4. **The Borrow & Deploy note reads as the Deposit tab's.** Unconnected, `ModeToggle` prints "Connect a wallet to borrow against your Trove." under the tab row while Deposit is selected. Every other note starts with the tab's name (the component's own rule, so the `Term` lands on it); this one does not.
5. **Orange means two things.** In the light palette `btc` (`#B03A0B`) and `warning` (`#92400E`) are both orange-brown. The BTC exposure figure and the entry-gap warning look alike, and the warning is told apart by colour only.
6. **The entry-gap warning is six lines on a phone.** "≈ 38.93 MUSD (3.9%) below the 1,000 MUSD you put in, at the BTC price: MezoRoute fee, the pool's swap fee, and the pool's BTC price." sits inside "You receive".

## Goals

- On the two planner pages, one precision per unit: MUSD 2 decimals, LP 4, BTC 6 (BTC entries keep `btcFine`, 8), MEZO 2.
- The amount field shows grouped digits when it is not being edited.
- Each figure has one framing: a 30% BTC fall is stated as the value left, everywhere on the planners.
- The card header says something that does not depend on the typed amount and is true for the Staking choice.
- The LP planner's comparison shows this week's MEZO rate for the amount it compares, typed or example.
- The Borrow & Deploy note names its tab.
- A warning on the planner carries an icon, not only a colour.
- The entry-gap line in "You receive" fits one or two lines; its causes are one tap away.

## Non-goals

- The Confirm pages (`/route/lp/confirm/`, `/route/stability-pool/confirm/`), receipts, Positions, Dashboard, `/compare/`, Trove pages. Confirm keeps 4-decimal MUSD and the full gap sentence: it is the exact-terms page.
- Colour tokens. `btc` and `warning` keep their values in both palettes; `contrast.test.ts` is untouched.
- A sticky primary on mobile (the review's finding 3). It changes layout and gets its own design.
- Any quote, gate rule, transaction, calldata, gas budget, or contract. `npm run calldata-parity` must still match against a `main` build.
- The landing simulator and the "Mainnet today" card.

## Anti-goals

The pass fails, even if it builds, if:

- a figure on a planner is rounded in the user's favour where the app rounds against it today (balances and values truncate; costs and the gap round up);
- the URL, the parsed amount, or what Max fills changes because of grouping (`?amount=1000` stays `1000`; grouping is display only);
- the field's caret jumps or digits are lost while typing;
- the comparison and the card disagree on a figure they both show for the same amount and block;
- the Stability Pool gains a rate, an APR, or the word "earn" (U13/U17 anti-goal, still binding).

## Design

### 1. Precision (planner pages only)

- `components/lp/units.ts` gains `musdShort` (2 decimals, truncating, as `formatToken(v, 18, 2)`) and `lpShort` (4 decimals). The LP planner's card rows (`Deposited to the pool`, `MezoRoute fee`, the `You receive` figure and minimum, the price-impact cost, the BTC exposure sub) and the Stability Pool planner's card rows use them. `musd`/`lp` keep 4/6 for Confirm and the other pages.
- The gap amount stays `entryGap`'s 2 decimals rounded up (already the rule).
- MEZO a week: `stakeLines` and `stakeOffLine` in `lib/gauge/copy.ts` format with 2 decimals instead of 4. Their only callers are the LP planner's Staking row and `StakeToggle`, so the change is planner-wide by construction; 2 decimals matches the aside and the header.
- A value that truncates to zero keeps `formatToken`'s `<0.01` rule, so a small fee never reads as `0`.

### 2. Grouped amount field

- `TokenAmountInput` shows the amount grouped (`1,000`, `12,345.67`) while the input is not focused, and the raw text while focused. The grouping is a pure function in `lib/flow/` (`groupAmount(text)`: groups the integer part of a well-formed decimal string; returns any other text unchanged, so a malformed entry still shows what was typed next to its field error).
- Typed or pasted commas are stripped before `onAmount` (`"1,000"` → `"1000"`), so the URL, `parseMusdAmount`, and every quote see the same digits as today. `parseMusdAmount` itself does not change.
- Applies to every `TokenAmountInput` in amount mode (it is one component); percent mode (exit, withdraw) shows a computed amount and is unchanged.

### 3. One framing per fact

- **Header** (`lpHeaderFigure`): never the amount-dependent MEZO a week.
  - Staking on, week open, APR known (mainnet): `At this week's rate` · `≈ X% APR` (unchanged).
  - Staking on, week open, no APR (testnet: no MEZO price): `Staked LP earns` · `MEZO`.
  - Otherwise (Staking off, between weeks, unavailable): `Pool` · `0.04% swap fee` (unchanged).
  The `weekly` input is dropped from `lpHeaderFigure`.
- **MEZO a week** then appears in the Staking row (the decision it belongs to) and in the comparison's "This week" row (the side-by-side), both at 2 decimals from the same `weekly` for the same amount.
- **A 30% BTC fall** is the value left everywhere: the card's BTC exposure sub becomes `If BTC −30%: ≈ 804.09 MUSD (−195.91)` (value truncated, loss rounded up, both `musdShort`-precision); the comparison keeps `≈ 804.09 MUSD`; the Stability Pool side keeps `1,000 MUSD`. A BTC entry keeps its "pool share only" sub.

### 4. Comparison rate for the compared amount

`LpRoutePage` computes the comparison's figures once: `plannerLpFigures` for `comparison.amountMusd`, then `lpWeekRate` with that liquidity, and passes those `apr`/`weekly` to `plannerComparisonRows` — the same wiring `SpRoutePage` already uses. The card keeps its own `lpWeekRate` from the card quote for the Staking row. For a typed amount both liquidities come from `quoteEntry` on the same pool, so they are equal; a test pins that.

### 5. Borrow & Deploy note

`ModeToggle`'s unconnected note becomes "Borrow & Deploy needs a connected wallet with a Trove." It starts with the tab's name, so `withTerm` puts the glossary term on it like every other note.

### 6. Warnings carry an icon

- `ReceiveRow`'s `note` renders with a leading `CircleAlert` (lucide, `h-4 w-4`, `aria-hidden`), in `text-warning-ink`.
- `Overview` rows with `tone: "warning"` render the same icon before the value. `btc`-toned rows get no icon. This is shared with Confirm, which also gains the icon on its warning rows — the same meaning, so it is consistent rather than out of scope.
- `icon-guard.test.ts` rules apply (14 px text → `h-4 w-4`).

### 7. Shorter gap line

- `entryGapLine` (planner only) becomes `≈ 38.93 MUSD (3.9%) below what you put in`, followed in `ReceiveRow` by ` · ` and a `Why` link to `#details` (same link style as the risk line's `Details`).
- Details gains, first, the row Confirm already shows: label `Below what you put in`, value `≈ 38.93 MUSD (3.9%)`, sub `at the BTC price: ` + `ENTRY_GAP_CAUSE`, tone `warning`. Built by one shared helper so Confirm and the planner cannot drift (`ConfirmSummary` switches to it).
- The `Why` link opens the `<details id="details">` element as the risk line's link does today.

## Testing

- Pure tests: `groupAmount` (integers, decimals, leading/trailing dot, malformed text unchanged), comma stripping, `lpHeaderFigure` (three cases, no `weekly`), `lpExposureRow` sub, `entryGapLine` short form, the shared gap row, `stakeLines`/`stakeOffLine` at 2 decimals, `ModeToggle` note text, planner LP figures equal to the card quote for a typed amount, and the LP comparison showing a MEZO rate for the empty-field example.
- Existing guards (`typography`, `icon-guard`, `colour-roles`, `layout`, `design-doc`) pass unchanged.
- `cd frontend && npm test && npm run build`; `npm run calldata-parity` against a `main` build.
- QA with Playwright on the served export, no wallet, testnet, 1440 and 375 px: `/route/lp/` empty and `?amount=1000`, `/route/stability-pool/?amount=1000`; check the field grouping on blur and raw on focus, the header, the aside rate in the empty state, the note, the icon, and the gap line with its `Why` link.

## Left to the builder

- Where `musdShort`/`lpShort` live if `units.ts` is the wrong home.
- Whether `groupAmount` runs on blur or derives from focus state, provided the caret never jumps.
- Exact test file placement.
