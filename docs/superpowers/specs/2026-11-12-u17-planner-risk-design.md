# U17: Risk first on the planners, and both routes readable without a wallet (design)

Date: 12 Nov 2026 · Branch: `feat/u17-planner-risk` (from `main` at `db650ec`) · Source: the UX review of production run on 12 Nov 2026 (Playwright, no wallet, 1440 and 390 px, testnet and mainnet), approved in chat by the user, who asked for the quick fixes and the flow changes to be built together.

## Why

MezoRoute's promise is "Route MUSD. Know the BTC risk." The review found five places where production does not keep it:

1. **Yield is louder than risk.** On mainnet the LP planner's header and its comparison aside say "≈ 41% APR", while "BTC exposure" and "If BTC −30%" sit in a closed Details. The landing says the same pool lost 5.89% over the last 30 days.
2. **A deposit loses value on arrival and the page does not say so.** A 1,000 MUSD deposit on testnet charts "Today 970.06". The cause is real and computable: the position is valued at the oracle BTC price (73,974 MUSD) while the pool sold BTC at about 78,500, so `499.40 MUSD + 0.006362 BTC × 73,974 = 970.0`. The card only shows "fee 0.1%" and "price impact 0.04%". The chart then measures the −30% loss from 970, not from the 1,000 put in.
3. **Only one route can be planned without a wallet.** The landing says "Both routes for one amount. No wallet needed", but `/route/stability-pool/` and `/compare/` show a connect card, and the LP planner's "Choose Stability Pool" leads to it.
4. **Nothing stops a bad amount before connecting.** `plannerView` drops every block while unconnected, so 5,000 MUSD on mainnet (cap 1,000, price impact 6.63%) quotes as if it could be sent.
5. **The aside contradicts the card.** With Staking on, the card says "swap fees go to veBTC voters instead of you" and the aside says "You get: Swap fees" (testnet) or "Swap fees + MEZO" (mainnet).

U17 fixes these and the smaller findings of the same review. It changes what the pages say and when they say it. It does not change a quote, a gate rule, a transaction, or a contract.

## Goals

- The LP card shows the BTC this deposit adds and what a 30% BTC fall does to it, without opening anything.
- The value a deposit has right after it lands, and the gap to what was put in, are stated where the user reads what they receive.
- Both planners (`/route/lp/`, `/route/stability-pool/`) and `/compare/` work with no wallet, each with one `Connect to review` primary where a wallet is needed.
- The two planners carry the same comparison, from one pure function, so the same amount at the same block reads the same on both.
- An amount the chain would refuse (above the cap, too small, price impact above 5%) is refused at the field before a wallet connects.
- Every sentence about who receives swap fees agrees with the Staking switch.

## Non-goals

- Changing `entryBlock`'s rules or order, `entryPreview`'s quote, `quoteEntry`, any calldata, gas budget, or contract. `npm run calldata-parity` must still match 16/16 against a `main` build.
- A read-only Dashboard, Positions, Confirm, receipt, exit, withdraw, or Trove flow. Those need an account; the Trove pages only get a better connect state (§7).
- The 30-day backtest inside a planner. It stays on `/compare/`, which the planners link to.
- A confirmation dialog when switching to mainnet, and renaming the "Dashboard" nav item (review severity 1; the chip, its colour, and the mainnet banner already say it).
- A new valuation model. Position values stay as the app computes them today (oracle price for exposure and the charts).
- Any APR, percentage, or projection for the Stability Pool.

## Anti-goals

The design fails, even if it builds, if:

- the Stability Pool shows a rate, an APR, or the word "earn";
- a visitor without a wallet sees a `0` presented as their balance, deposit, gain, or total exposure;
- a pre-connection notice blames the visitor's wallet (insufficient balance, gas, wrong network);
- a page has two accent buttons;
- the entry gap is ever shown as a gain (when the pool prices BTC below the oracle the line is simply absent);
- the card and the aside state different figures for the same thing at the same block;
- a connected user's blocks, recoveries, steps, or payloads differ from `main`.

## 1. LP card: risk at the first level

`LpRoutePage` builds `overview` (the card) and `context` (Details). U12 put "BTC exposure" in `context`. U17 moves it to `overview`, directly under "Deposited to the pool". This reverses that part of U12 on purpose.

| Row | Value | Sub line |
|---|---|---|
| Deposited to the pool | unchanged | unchanged |
| **BTC exposure** | `+0.006362 BTC` (tone `btc`, as today) | `If BTC −30%: ≈ −188.39 MUSD` |
| MezoRoute fee | unchanged | unchanged |
| Price impact | unchanged | from 1%: `≈ 16.60 MUSD · includes the pool's swap fee` |
| Staking | unchanged | unchanged |

- The −30% figure is the loss **against the MUSD put in**: `amountIn − (value of this deposit's LP after a 30% fall)`, with the LP value from the existing constant-product helper (`lpMoveFactor` / `lpValueAfterDrop`) applied to this deposit's own LP value at the oracle price. It is this deposit only, never the wallet's total.
- A BTC entry keeps today's sub line ("pool share only; the BTC you deposit leaves your wallet") and gets no MUSD figure: holding the BTC would have fallen too.
- Borrow & Deploy shows the row like a plain deposit; its Trove rows stay in Details.
- The price-impact MUSD figure appears from `PRICE_IMPACT_WARN` (1%). `priceImpact` is the swap's loss against the pre-trade mid price (`src/lib/quote/entry.ts`), so the figure is `musdToSwap × priceImpact` for a MUSD entry and `btcToSwap × priceImpact`, shown in BTC, for a BTC entry.
- `context` keeps the Trove change and the network fee.

### What you receive

The receive block today leads with the LP token count, which says nothing to a borrower. New content, same component:

1. `LP worth ≈ 970.06 MUSD`: the deposit's own LP value at the oracle price (the same value the chart's "Today" point adds).
2. `≈ 1.782493 LP · at least 1.764668 LP`: the count and the guaranteed minimum, as today, on one line.
3. Only when the value is at least 1% below the amount put in, in the `warning` tone: `≈ 29.94 MUSD (3%) below the 1,000 MUSD you put in, at the BTC price: MezoRoute fee, the pool's swap fee, and the pool's BTC price.` The threshold reuses `PRICE_IMPACT_WARN`. Below 1% the line is absent; when the value is above the amount put in it is absent too (anti-goal).

A BTC entry values the amount put in at the oracle price for line 3.

**One valuation on the flow.** The planners value LP at the oracle BTC price, like the exposure maths, the charts, and the Trove. The LP Confirm page says "≈ … MUSD at the pool price" today (`entryValue`, U8); it switches to the same value and the same gap line, so Amount and Confirm never disagree. `/compare/` keeps valuing LP at the pool's own price (F6's decision, said in its footnote); U17 does not unify the two, and the planner's line names its price ("at the BTC price") so the difference is explained rather than hidden.

### The chart in Details

For a deposit preview, `ExposurePanel`'s value chart measures against what was put in:

- the dashed "Kept in MUSD" line is flat at `value before (today) + amount put in`, not at today's value after the deposit;
- the readout's change is against that line: `If BTC −30%: 811.61 MUSD · −188.39 (−19%)`;
- the Dashboard and Positions charts (no deposit) are unchanged: their baseline stays today's value (U15).

Without a wallet, the panel's headline must not read `0 BTC → 0.006362 BTC · Total BTC exposure`. It reads `+0.006362 BTC` with the caption `This deposit only. Connect to include your Trove and positions.`

## 2. One comparison for both planners

`plannerComparisonRows` (`src/lib/flow/planner-comparison.ts`) returns both routes. Its rows change to:

| Row | MUSD/BTC LP | Stability Pool |
|---|---|---|
| You get | Staking on: `MEZO`, sub `swap fees go to veBTC voters` · off: `Swap fees` | `BTC from liquidations` |
| This week | Staking on and the week pays: `≈ 41% APR` or `≈ N MEZO a week` · on, between weeks: `New week's rate not set yet` · off: `Pool fee 0.04%` | `Variable · paid in bursts` |
| BTC exposure | `+0.006362 BTC` | `None until a liquidation` |
| If BTC −30% | `≈ 811.61 MUSD` | `1,000 MUSD`, sub `new liquidations not modelled` |
| Exit | `Any time, at the pool price` | `Paused while any Trove is below MCR` |

- "Staking on" means `preview.stake.on` (`effectiveStake`: the switch is on and staking is available), the value the card's Staking row and the transaction use. Staked between weeks is still staked: `MEZO`, with the rate line saying it is not set yet.
- The LP figures are this deposit's quote valued at the oracle price (§1): the page's own quote on the LP planner; for the example amount (empty field) and on the Stability Pool planner, the same pure `quoteEntry` run on the snapshot's pool state and fee. One function produces them for both pages, and a parity test pins: same snapshot, same amount, same stake flag → identical rows.
- The "Held" row goes; "BTC exposure" and "Exit" say what it said. The footnote becomes `No annualised rate for the Stability Pool.`
- Under the rows, a text link `30-day results for both routes` leads to `/compare/?amount=<amount>`.
- `PlannerComparison` takes which route is the other one: title `Compare with the Stability Pool` / `Compare with the MUSD/BTC LP`, action `Choose Stability Pool` / `Choose MUSD/BTC LP`, the link carrying the amount. The page's own route is listed first.
- A BTC entry keeps `BTC_COMPARE_MESSAGE`; Borrow & Deploy keeps hiding the card.

## 3. Refusing an amount before a wallet connects

`plannerView` returns `block: null` while unconnected. New rule: unconnected, the page shows a block only when the **amount** causes it and the chain alone decides it: `above-cap`, `too-small`, `price-impact`. Wallet blocks (`insufficient-balance`, `needs-gas`, `gas-price-unknown`, `above-headroom`, `wrong-network`, the borrow reasons) stay hidden, as U13 requires.

- `entryBlock` checks the balance before the cap, so with a zero-address balance it answers `insufficient-balance` first. The unconnected verdict therefore comes from a pure helper in `src/lib/flow/planner.ts` that asks `entryBlock` with the wallet's side neutralised (the balance equal to the amount, gas present, the wallet on the selected network) and keeps the answer only if its reason is one of the three. `entryBlock` itself is not edited.
- The message shows at the field through the existing `lpFieldError` (`aria-invalid`, the message under the input). The primary stays `Connect to review` and stays enabled: it is the page's only accent button, and connecting is never wrong.
- The Stability Pool has no amount-caused chain block (no cap, no fee), so its unconnected view has none.

## 4. Input that cannot be an amount

- **Planner fields (LP and Stability Pool).** Text that does not parse as an amount shows the simulator's message at the field (`Enter an MUSD amount like 20 or 20.5 (up to 18 decimals).`, or its BTC form) and is not written to the URL, so a reload does not bring it back. `0` and an empty field stay silent, as today.
- **Landing simulator.** With an empty, zero, or unparsable field the table and chart keep the previous amount's figures today (the caption still says "Both routes for 5,000 MUSD"). New: they fall back to the 1,000 MUSD example, the caption says `Both routes for 1,000 MUSD (example)`, and no preset is marked as selected. The Plan link carries no amount in that state.

## 5. Stability Pool planner without a wallet

`/route/stability-pool/` drops `RequireWallet`, the way U13 did for `/route/lp/`.

- `useSpSnapshot(account | undefined)` reads with `zeroAddress` when there is no account, disables the gas-balance query, and reports `0n` for it (no figure shows it). A `reconnecting` account shows the loading card.
- Zero-address reads, verified 12 Nov 2026 on both networks with `cast call … 0x000…000`: `StabilityPool.deposits(0x0)` = 0 and `MUSD.allowance(0x0, stabilityPool)` = 0 on testnet (`0x1CCA…680e`, `0x1189…c503`) and mainnet (`0x7324…0e32`, `0xdD46…F186`); `getCompoundedMUSDDeposit(0x0)` = 0 on testnet. The dashboard and gauge reads in the same multicall are the ones `/route/lp/` already makes with the zero address in production. No `tolerate` entry is expected; if a read reverts for the zero address, tolerate exactly that index as U13 did and record it here.
- **Unconnected card:** the amount field with no balance and no Max; overview rows `BTC exposure: None until a liquidation` (sub `If BTC −30%: 1,000 MUSD, unchanged · new liquidations not modelled`), `MezoRoute fee: None (direct protocol call)`, `Network fee (estimated)`. "Your deposit now", "Deposit after", and "Pending BTC gain" are absent (anti-goal). The primary is `Connect to review` through `ConnectCta`, as on the LP card. The amount stays in the URL through the connection.
- **Connected card:** today's rows plus the same `BTC exposure` row. Blocks, recoveries, and the Review link are unchanged.
- **Aside:** `PlannerComparison` with the LP as the other route (§2), then `SpDepositAside`. Without a wallet the aside shows the sign facts only, not a position of zero.
- Details (the explainer, `ExposurePanel` when there is an amount, `SpRisksCard`) is available in both states; without a wallet the exposure panel follows §1's caption rule.
- `/route/stability-pool/confirm/` keeps its wallet gate.

## 6. Compare without a wallet

`/compare/` drops `RequireWallet`.

- `useDashboardSnapshot(account | undefined)` reads with `zeroAddress` and disables the gas-balance query, as above. `Home` keeps passing a real account.
- `RouteComparison` already starts from a 1,000 MUSD example when the wallet holds less than 1 MUSD and labels it; that is the unconnected state. It gains one input: a valid `?amount=` in the URL is its starting amount (and is then not labelled an example).
- `WrongNetworkAlert` shows only when a wallet is connected. `MainnetReferenceCard` is already wallet-free.
- Its route actions lead to the planners, which are now both readable.
- The landing's simulator card gets a text link under "Plan this amount": `30-day results for both routes` → `/compare/?amount=<amount>`. The hero is not touched.

## 7. Smaller fixes from the same review

- **Landing, testnet.** The sentence "You're on Testnet: these figures are Mezo mainnet; your transactions will use test tokens." moves from the bottom of the simulator card to directly under its heading row, above the amount field.
- **Trove pages before connecting.** `/trove/{unwind,close,leverage}/` render a bare "Connect a wallet to continue" card with no heading. They get `ConnectPage` like the Stability Pool had: the action's own h1 and step, a card titled with the action, one sentence saying what it does, and "EVM wallets only" for the flash actions. Their Confirm pages keep the generic gate.
- **Trust line below `lg`.** On a phone "Before you sign" sits about 700 px under the primary. Below `lg` only, the LP and Stability Pool cards show one line above the primary: `Unaudited software · cap 1,000 MUSD · Before you sign` (the Stability Pool has no cap and omits it), where "Before you sign" is a link to that card. From `lg` the aside is beside the card and the line is absent. This is a deliberate, narrow exception to U14's "no fact in both card and aside".
- **Chart value labels.** A value label must not sit on its own series line (the line crosses "811.61", "970.06", "1,130" today). `placeLabels` keeps labels clear of the line they belong to; a geometry test pins it.
- **Hero figure.** "14.17M MUSD" is 177 px wide in a 151 px box at 1440 px and touches the route motif. The figure must fit its box from 1024 px up.

## Constraints

- `frontend/DESIGN.md` and every guard in `npm test` (type scale, radius, spacing, control, colour roles, motion, heading, layout). One h1 per page; `Term` on the first naming label only and never inside a link, button, or tab.
- U14's frame: every state of a flow route renders `FlowColumn` or `FlowState`, so the card's left edge and width do not move between the unconnected, loading, and connected states.
- The wallet tree rules in `AGENTS.md` (no wagmi hook in a statically imported module; `WagmiProvider` never re-renders).
- One multicall snapshot per page, one block; the comparison adds no second snapshot.
- Copy rules already in the repo: rates are "this week's" and never promised; staking copy says swap fees go to veBTC voters; route risk copy comes from `src/lib/routes/copy.ts`.
- TDD: the pure rules (comparison rows and their parity, the unconnected block helper, the entry-gap line and its threshold, the −30% loss, the simulator's fallback amount, label placement) get tests first.

## Left to the builder

- Exact wording inside the rules above, and the names and shapes of helpers and props.
- Where the "LP worth" value and the entry gap are computed (a pure function beside `lp-entry.ts` is the obvious home).
- Whether the unconnected block helper takes a flag on `entryPreview` or recomputes from its quote, as long as `entryBlock` and the connected path are untouched.
- Whether `SpEntryCard` takes an action node like `LpEntryCard.action.node`.

## Verification

- `cd frontend && npm test && npm run build`.
- `npm run calldata-parity` against a `main` build: 16/16.
- Playwright on the served export, without a wallet and with the keyless mock wallet, at 360, 390, 768, and 1440 px, both themes, both networks:
  - each row of the review's issue table is re-observed fixed (or is one of the two listed non-goals);
  - no horizontal scroll, 0 console errors, one accent button per page;
  - connecting from each planner keeps the amount; the connected pages match `main` for blocks and recoveries;
  - LP and Stability Pool planners show identical comparison rows for the same amount.
- `AGENTS.md` (Frontend section) and `docs/STATUS.md` updated with the branch.

## Calls made in this design (not the user's words)

- BTC exposure returns to the card, reversing U12's move of it into Details.
- The receive block leads with the MUSD value; the LP count and minimum share one line.
- The entry gap is shown from 1% and never as a gain.
- The LP Confirm page's value line moves from the pool price to the oracle price to match the planner; `/compare/` keeps the pool price.
- The 30-day result is a link to `/compare/`, not a row in the planners.
- An amount block before connecting leaves `Connect to review` enabled.
- An empty simulator falls back to the labelled 1,000 MUSD example instead of blank cells.
- No mainnet-switch confirmation and no nav rename.
