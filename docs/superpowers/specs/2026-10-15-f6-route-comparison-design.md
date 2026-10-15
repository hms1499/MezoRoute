# F6 — Route comparison with 30-day on-chain results (design)

Date: 15 Oct 2026 · Task: F6 in `PRODUCT_SPEC.md` §16 · Depends on: F2 (dashboard snapshot, exposure module), F3 (`quoteEntry`, `afterEntry`), F5 (SP route) · Branch: `feat/f6-route-comparison`

## Goal

On the dashboard, a user types an MUSD amount and sees the MUSD/BTC LP route and the Stability Pool route side by side: where the return comes from, what each route actually paid over the last 30 days, what that amount would be worth today had it gone in 30 days ago, the fee, the position and BTC exposure after the deposit, the value after a 30% BTC drop, and the risks. The user then continues to the chosen route with the amount carried over (PRODUCT_SPEC §7 Flow B, FR-19, §9 screen 1, demo step 2 "Enter 20 MUSD"). The user approved this design on 15 Oct 2026, including the 30-day results (option B).

## Decisions

| Topic | Decision |
|---|---|
| Placement | A "Compare routes" card on the connected dashboard, between the exposure panel and the positions summary (§9 screen 1). Not shown before a wallet connects. |
| Amount | Local component state (not in the URL), parsed with `parseMusdAmount`; Max fills the wallet MUSD balance. An amount above the balance is still compared, with a note; the route pages gate it. |
| Modes | Plain deposits only. Borrow & Deploy stays a toggle on the LP route page. |
| 30-day source | State at two blocks: one multicall at the block ≈30 days ago, one at the head. Pool fee indexes, reserves, LP supply, swap fee, oracle price, and Stability Pool `P`/`S`/epoch/scale. Not an event scan: mainnet has more than 1,000 pool `Fees` events in 30 days (Blockscout's page size), and events only add counts. |
| LP 30-day figure | Fees as a share of the amount over the actual window, plus a simple annualised rate ("≈Y% a year, fees only"). This matches the trailing-window APY other dashboards show (DefiLlama's "30d Avg APY"). |
| SP 30-day figure | No annualised rate. SP returns arrive in bursts (Liquity once reported 751% for a single week), so a rate from one window misleads. Show what happened: "No liquidations reached the pool" or "BTC gains X% · deposit absorbed Y%". |
| "Your amount 30 days ago" | Both routes are backtested with the typed amount (1,000 MUSD when the field is empty), valued today at the oracle price. Labelled "Past results, not a forecast". |
| LP fee | The executor fee comes from `network.executor.feeBps`. Mainnet has no executor until M1: the quote uses 0 and the fee row reads "Set at launch". The route CTAs stay enabled on mainnet, and the route pages show the read-only state. |
| Pool swap fee | `PoolFactory.getFee(pool, false)` moves into the dashboard snapshot, so the comparison quotes from the same block as everything else. The LP route snapshot reuses it instead of reading it again. |

## Chain facts (15 Oct 2026)

- Both public RPCs answer historical `eth_call` (archive state). Checked: pool `index0/index1/totalSupply/getReserves`, SP `P/currentEpoch/currentScale/epochToScaleToSum/getTotalMUSDDeposits/getCollateralBalance`, and `PriceFeed.fetchPrice` at a block 640,000 below the head, on testnet (`rpc.test.mezo.org`) and mainnet (`mainnet.mezo.public.validationcloud.io`). Multicall3 (`0xcA11…CA11`) has code at those blocks on both networks.
- Block time over the last 500,000 blocks: testnet 4.19 s, mainnet 3.92 s. A fixed block count gives different windows: 640,000 blocks back was 14 Sep on testnet and 16 Sep on mainnet. The window is therefore computed from timestamps (below).
- Tigris `Pool._update0/_update1` (`lib/tigris/solidity/contracts/Pool.sol`) take the swap fee out to `PoolFees` and add `fee × 1e18 / totalSupply` to `index0`/`index1`. An LP token held through a window earns exactly `Δindex / 1e18` of each token (F7's claimable formula, rounding down per swap). LP tokens staked in a gauge earn emissions instead, and the gauge passes their fees to voters. MezoRoute users hold LP unstaked, so the index is what they earn. Gauge rewards are out of scope.
- Mainnet pool `0x52e6…acefb`: token0 is BTC, swap fee 30 bps. From block 11,878,862 (16 Sep 2026 03:23 UTC) to ≈12,518,862: `index0` +4.03e12 (BTC per 1e18 LP), `index1` +3.648e17 (MUSD per 1e18 LP). LP token value today ≈ 571.8 MUSD (287.3 MUSD + 0.00348 BTC at 81,733.75), so fees ≈ 0.69 MUSD per LP token, **≈0.12% in 29 days, ≈1.5% a year**. LP supply fell from 688.4 to 356.9 over the window, which does not affect the per-token figure.
- Testnet pool `0xd16A…6AA9` (token0 MUSD): `index0` +2.8e12 over 31 days, so fees are effectively zero.
- Stability Pool, both networks: `P`, `epochToScaleToSum(0,0)`, epoch 0 and scale 0 were the same at the old block and the head. **No liquidation was offset by the Stability Pool in the last 30 days**, so the SP backtest returns the deposit unchanged with no BTC gain. Mainnet SP: 14.17M MUSD deposited. `SCALE_FACTOR` = 1e9 (Liquity v1 maths).

## 1. Pure modules (`src/lib/compare/`)

- `window.ts`: `HISTORY_DAYS = 30`. `pastBlock(head, headTime, refTime, refSpan)` returns `head − floor(30 days × refSpan / (headTime − refTime))`, where `ref = head − 100,000`. The window is `[pastTime, headTime]`, using the real timestamp of the chosen block. `annualise(ratioWad, seconds)` is a simple rate, `ratio × 365 days / seconds`.
- `lp-backtest.ts`: `lpBacktest({ past, now, amount, executorFeeBps })`. `past` and `now` carry reserves mapped by token address, `totalSupply`, the fee indexes mapped to MUSD/BTC, the swap fee, and the oracle price.
  - Entry: `quoteEntry(pastPool, amount, executorFeeBps)` gives `liquidity` and `musdRefund`. A null quote returns null.
  - Fees: `liquidity × ΔindexMusd / 1e18` MUSD and `liquidity × ΔindexBtc / 1e18` BTC.
  - Position today: `liquidity × reserve / totalSupply` of each token at `now`.
  - Value today: position MUSD + `musdRefund` + fees MUSD + (position BTC + fees BTC) × price now.
  - Returns `{ valueNow, feesValue, feeReturnWad: feesValue × 1e18 / amount, feeRateWad: annualise(...) }`. Every division rounds down.
- `sp-backtest.ts`: `spBacktest({ past, now, amount })` with `past = { P, S, epoch, scale }` and `now = { P, epoch, scale, sumAtPastScale, sumAtNextScale, price }`, following Liquity v1's `getCompoundedStakeFromSnapshots` and `getDepositorCollateralGain`:
  - BTC gain: `amount × (sumAtPastScale − S + sumAtNextScale / 1e9) / P / 1e18`.
  - Deposit: 0 if the epoch moved. Otherwise `amount × P_now / P` when the scale is unchanged, that divided by 1e9 when it moved by one, and 0 when it moved by more. Below `amount / 1e9` the deposit counts as 0.
  - Returns `{ depositNow, btcGain, valueNow: depositNow + btcGain × price, gainReturnWad, lossReturnWad, liquidated: P or S changed }`.
- `comparison.ts`: `compareRoutes({ snapshot, amount, executorFeeBps, network })`, the per-amount part:
  - LP: `quoteEntry` with the snapshot's pool and swap fee, then `afterEntry`, then `exposure` and `drawdownScenarios` (the −30% row).
  - SP: `afterSpDeposit(snapshot, amount)`, then the same exposure maths.
  - Each side returns `fee` (MUSD; SP 0), `positionAfter` (LP: the new LP share's value at the oracle price; SP: `amount`), `btcBefore`, `btcAfter`, `valueAtMinus30` (the new position only: the −30% scenario's LP or SP value after the deposit minus the same value before it), `overBalance`, and an LP `status` of `"ok" | "too-large"` (`quoteEntry` null).
- `src/lib/stability-pool/after-deposit.ts`: `afterSpDeposit(snapshot, musdIn)` is extracted from `spDepositPreview().after`, which then calls it. The behaviour is unchanged: deposit + amount, the gain is paid to the wallet, wallet MUSD − amount.
- `copy.ts`: return source, risk lines, and route labels as constants, taken from Flow B and F5's risk sentences, so the card and the route pages say the same thing.

## 2. Data

- **Dashboard snapshot** (`src/lib/dashboard/snapshot.ts`): add `PoolFactory.getFee(pool, false)` as the last dashboard read; `DashboardSnapshot.lp` gains `feeBps`. `DASHBOARD_READS` grows by one; `lpRouteContracts` drops its own `getFee` and `parseLpRouteSnapshot` takes `feeBps` from the dashboard part. The SP snapshot slices by `DASHBOARD_READS` and needs no other change.
- **History** (`src/lib/compare/history.ts`, `useRouteHistory`): uses wagmi's public client for the selected `chainId`.
  1. `getBlock("latest")`, then `getBlock(head − 100,000)`, then `pastBlock(...)`.
  2. In parallel: `getBlock(past)` (its timestamp) and the past-state multicall (`multicall({ blockNumber: past, allowFailure: false })`): pool `index0`, `index1`, `getReserves`, `totalSupply`, `PoolFactory.getFee`, `fetchPrice`; SP `P`, `currentEpoch`, `currentScale`.
  3. In parallel, since both need the past epoch and scale:
     - at `past`: SP `epochToScaleToSum(pastEpoch, pastScale)`.
     - at `head` (pinned to the head block number): pool `index0`, `index1`, `getReserves`, `totalSupply`, `fetchPrice`; SP `P`, `currentEpoch`, `currentScale`, `epochToScaleToSum(pastEpoch, pastScale)`, `epochToScaleToSum(pastEpoch, pastScale + 1)`.
  4. Results are parsed into the backtest inputs (indexes and reserves mapped with `musdIsToken0`).
  - react-query key `[network.id, "route-history"]`, `staleTime` 10 minutes, no interval refetch, 15 s timeout. A failure shows "30-day results unavailable" with Retry inside the card and never hides the rest of it.
- `src/lib/abi/musd.ts` gains the SP getters `P`, `currentEpoch`, `currentScale`, `epochToScaleToSum`. `src/lib/abi/pool.ts` gains `index0`, `index1` if missing.

## 3. UI (`src/components/dashboard/RouteComparison.tsx`)

- **Header:** "Compare routes", an amount field (MUSD) with Max, and an inline error for malformed input.
- **Two columns** with equal rows, stacked on phones: **MUSD/BTC LP** ("Earn swap fees") and **Stability Pool** ("Back the system").
  1. *Return source*: swap fees / BTC from liquidations, bought at a discount to debt.
  2. *Last 30 days* (window dates in the row label):
     - LP: "Fees X.XX% (≈Y.Y% a year, fees only)".
     - SP: "No liquidations reached the pool", or "BTC gains X.XX% · deposit absorbed Y.YY%".
  3. *Your N MUSD on <date> → today*: the backtest's `valueNow`, signed change in MUSD and %. LP includes the BTC price move.
  4. *MezoRoute fee*:
     - LP: "0.10% (0.02 MUSD)", or "Set at launch" on mainnet.
     - SP: "None (direct to the pool)".
  5. *Position after*: estimated value in MUSD. LP also shows "≈ half becomes BTC".
  6. *BTC exposure*: before → after, from the exposure module.
  7. *If BTC drops 30%*: the new position's value.
  8. *Risks*: two or three short lines each (impermanent loss, pool liquidity / deposit can shrink, withdrawals pause while any Trove is under-collateralised).
  9. CTA: **Choose LP** → `/route/lp/?{entryQuery({ amount, slippageBps: parseSlippage(null) })}` (the default slippage); **Choose Stability Pool** → `/route/stability-pool/?{spDepositQuery(amount)}`.
- **Empty field:**
  - Rows 1, 2, and 8 show.
  - Row 3 uses 1,000 MUSD.
  - Rows 4–7 show "Enter an amount".
  - CTAs go to the routes without an amount.
- Footer: "Past results, not a forecast. LP gauge rewards not included."
- History loading shows skeleton cells in rows 2 and 3 only.

## 4. Errors and edge cases

- Malformed amount: inline message. Zero is treated as empty.
- LP quote null: the LP column's rows 5–7 read "Amount too large for the pool", and Choose LP stays enabled (the route page explains the block).
- Amount above wallet MUSD: a note under the field. Both CTAs stay enabled; the route gates block it.
- History failure or timeout: the inline unavailable state with Retry. The old block before the pool or SP existed (a revert at `past`) is the same state.
- No new revert strings or `decodeError` outcomes.

## 5. Testing

**Vitest:**
- `pastBlock` and `annualise` (exact maths, rounding).
- `lpBacktest` against the mainnet facts above, recorded as a fixture: fee return ≈0.12%, value change including the price move. Also a no-swaps case (zero fees) and a null quote.
- `spBacktest`: unchanged state (live fixture, returns the deposit), a liquidation within one scale (loss and gain against hand-computed Liquity figures), a scale change, an epoch change (deposit 0, gain from the old epoch), and the 1e-9 floor.
- `compareRoutes`: fee rows, mainnet zero fee, exposure before/after, −30% values, over-balance flag, too-large status.
- `afterSpDeposit` keeps `spDepositPreview` unchanged (existing tests).
- Dashboard and LP route snapshot parsing with the moved `getFee`.
- History parsing of multicall results into backtest inputs.

**QA by me:**
- Local export with a keyless mock wallet (the read-only recipe) on testnet and mainnet: card values against independent `cast` reads at the same two blocks; amount typing, Max, malformed input, over-balance note.
- CTAs land on both route pages with the amount filled in.
- The history failure state, by intercepting the historical `eth_call`.
- 360 px with no horizontal scroll.

**QA by the user:** the Vercel preview, "Enter 20 MUSD", then each CTA.

## Done when

- `npm test && npm run build` pass, and agent QA passes on both networks.
- `PRODUCT_SPEC.md`: Flow B table gains the "Last 30 days" and "Your amount 30 days ago" rows; FR-19 mentions the 30-day results; §16 records F6.
- `CLAUDE.md` frontend notes cover the comparison card, the two-block history reads (archive `eth_call`, window from timestamps), and the SP no-annualisation rule.

## Out of scope

Borrow & Deploy in the comparison; event counts (swaps, liquidations); gauge or MEZO rewards; charts or windows other than 30 days; a history cache beyond react-query; the comparison before a wallet connects.
