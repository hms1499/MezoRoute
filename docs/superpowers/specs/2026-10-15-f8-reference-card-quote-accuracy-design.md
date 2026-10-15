# F8 — Mainnet reference card and quote-accuracy script (design)

Date: 15 Oct 2026 · Task: F8 in `PRODUCT_SPEC.md` §16 · Depends on: F3 (quote engine), F6 (two-block history reads) · Branch: `feat/f8-reference-card`

## Goal

Two Wave 1 "Should" items (PRODUCT_SPEC §6):

1. **Mainnet reference card.** On testnet, the dashboard shows what the same routes look like on Mezo mainnet today: pool reserves, Stability Pool deposits and their share of MUSD supply, and the last 30 days' LP fees and liquidations (§9 screen 1, "testnet-only mainnet reference card"). The data is kept visually and textually separate from testnet execution data (§9 copy rules).
2. **Quote-accuracy script.** It compares the frontend quote engine with every live executor `Entered` event (§14 "Live checks"). The Wave 1 gate requires "quote-accuracy check within slippage tolerance" (§15).

The user approved this design on 15 Oct 2026.

## Decisions

| Topic | Decision |
|---|---|
| Card placement | Last card of the connected dashboard, shown only when the selected network is testnet. On mainnet the dashboard already shows real data. |
| Separation | A dashed border and a muted background, a "Mainnet · reference only" badge, and the footer "Read from Mezo mainnet. MezoRoute executes on testnet until launch." |
| Card data | Its own viem public client for mainnet, independent of the wagmi config, which only knows the selected network: one head multicall for reserves, LP supply, swap fee, price, MUSD supply, and SP deposits. The 30-day rows reuse F6's `fetchRouteHistory` and `backtestRoutes` with that client and `REFERENCE_AMOUNT`, with no executor fee. |
| RPC URL | `NetworkConfig` gains `rpcUrl`, matching Passport's chains: testnet `https://rpc.test.mezo.org`, mainnet `https://rpc-internal.mezo.org`. viem's own `mezo` chain points at `rpc.mezo.org`, which has no DNS record (checked 15 Oct 2026). |
| Card caching | TanStack Query, `staleTime` 5 minutes, no interval refetch, a 15 s timeout. A failure shows "Mainnet data unavailable" with Retry and never affects the rest of the dashboard. |
| Script runner | `npm run quote-accuracy` (testnet) or `QUOTE_NETWORK=mainnet npm run quote-accuracy` runs a Vitest file under a separate config (`vitest.live.config.ts`, `scripts/live/**/*.live.ts`). This keeps the `@/` aliases and TypeScript with no new dependency, and keeps it out of `npm test`. |
| Script scope | Every executor `Entered` from `executor.deployBlock` to the head. Mainnet without an executor prints "No executor on mainnet yet" and passes. |

## Chain facts (15 Oct 2026)

- **Testnet `Entered` events:** the executor `0xB36B…0920` has emitted 14 `Entered` events between blocks 15,903,026 and 16,150,944. Six are the second transaction of their block (`transactionIndex` 1), so the pool may already have moved within that block before them. The script detects that from pool logs earlier in the same block.
- **Swap amount:** the executor takes `musdToSwap` from the caller (`EnterParams`). S1 and the smoke script swapped a naive half; the app sends `optimalSwap(net)` at quote time.
  - The **simulation check** therefore uses the event's own `musdSwapped`, and must match to the wei.
  - The **quote check** compares the app's optimal quote with what happened, within slippage.
- **`Entered` fields:** `caller`, `recipient` (indexed), `musdBorrowed`, `musdIn`, `fee`, `musdSwapped`, `btcFromSwap`, `musdAdded`, `btcAdded`, `liquidityOut`, `musdRefund`, `btcRefund`.
- **Mainnet today:**
  - MUSD `totalSupply` is 29,871,966.5.
  - SP `getTotalMUSDDeposits` is 14,172,032.0, or 47.4% of supply.
  - The pool holds ≈101,720 MUSD and 1.2523 BTC, with a 30 bps fee.
- **Mainnet RPCs:** `rpc-internal.mezo.org` (Passport's mainnet RPC), `mainnet.mezo.public.validationcloud.io`, and `rpc-http.mezo.boar.network` all answer with `access-control-allow-origin: *`. `rpc-internal.mezo.org` serves historical `eth_call` (`index1` and `P` at head − 650,000).

## 1. Pure modules

- **`src/lib/reference/snapshot.ts`:**
  - `referenceContracts(network)` is the head multicall: pool `getReserves`, `totalSupply`, and `PoolFactory.getFee`, `PriceFeed.fetchPrice`, MUSD `totalSupply`, and SP `getTotalMUSDDeposits`.
  - `parseReference(network, results)` returns `{ reserveMusd, reserveBtc, lpSupply, feeBps, price, musdSupply, spDeposits }`, with reserves mapped by `musdIsToken0`.
  - `referenceView(reference)` returns `{ poolTvl: reserveMusd + reserveBtc × price, spShare: spDeposits × 1e18 / musdSupply }` (0 when supply is 0). All divisions round down.
- **`src/lib/quote/accuracy.ts`:**
  - `type EnteredEvent` holds the decoded fields plus `blockNumber`, `logIndex`, and `txHash`.
  - `checkEntry({ event, pool, feeBps, slippageBps })` returns:
    - `feeOk`: `event.fee === event.musdIn × feeBps / 10,000`.
    - `simulation`: `simulateEntry(pool, musdIn − fee, musdSwapped)` against the event, field by field: `btcFromSwap`, `musdAdded`, `btcAdded`, `liquidity` vs `liquidityOut`, `musdRefund`, `btcRefund`. It returns `{ ok, mismatches: string[] }`.
    - `quote`: `quoteEntry(pool, musdIn, feeBps)` gives `quotedLiquidity` and `deviationBps = (quoted − actual) × 10,000 / quoted` (signed). `withinSlippage` is `event.liquidityOut ≥ entryMinimums(quote, slippageBps).minLpOut`. `optimal` is `musdSwapped === quote.musdToSwap`.
  - `summarise(results)` counts checked, skipped, simulation mismatches, fee mismatches, quotes outside slippage, and the maximum absolute deviation in bps. `passed` is true when there are no simulation or fee mismatches and every checked quote is within slippage.

## 2. Data

- **Reference card** (`src/lib/reference/useMainnetReference.ts`):
  - A module-level `createPublicClient({ transport: http(networks.mainnet.rpcUrl) })`, created lazily on first use, never in render.
  - `queryFn` runs in parallel: `client.multicall({ contracts: referenceContracts(networks.mainnet), allowFailure: false, multicallAddress })`, and `fetchRouteHistory(client, networks.mainnet)` then `backtestRoutes(history, REFERENCE_AMOUNT, 0n)`, all wrapped in `withTimeout(…, 15_000)`.
  - It returns `{ reference, backtests }`. The hook is enabled only when the selected network is testnet.
- **Script** (`scripts/live/quote-accuracy.live.ts`):
  - It builds a viem client from `network.rpcUrl` and reads `executor.feeBps` from the config, checking it against the chain's `feeBps()` once.
  - Events come from `getLogs` for the executor's `Entered` in 10,000-block chunks from `deployBlock`, clamped to the head (Mezo returns an empty list past the head), decoded with the executor ABI, and checked to be `eventName === "Entered"`.
  - For each event:
    - It reads pool logs (`Swap`, `Mint`, `Burn`, `Sync`) in the same block. If any has a lower `logIndex` and a different `transactionHash`, the result is `skipped: "same-block pool activity"`.
    - Otherwise it runs one multicall at `blockNumber − 1` (`getReserves`, `totalSupply`, `getFee`) and calls `checkEntry`.
  - It prints one row per event (block, short tx hash, `musdIn`, `optimal`, simulation ok or mismatches, `deviationBps`, within slippage), then the summary. The Vitest test fails when `passed` is false.

## 3. UI (`src/components/dashboard/MainnetReferenceCard.tsx`)

- **Header:** "Mainnet today" with the badge "Mainnet · reference only".
- **MUSD/BTC pool:**
  - Reserves: "101,720 MUSD + 1.2523 BTC".
  - TVL: "≈ 204,000 MUSD".
  - Swap fee: "0.3%".
  - "LP fees, last 30 days": F6's `lpHistoryLine`.
- **Stability Pool:**
  - "Deposits": 14.17M MUSD, shown as a whole number with thousands separators.
  - "Share of MUSD supply": 47.4%.
  - "Last 30 days": F6's `spHistoryLine`.
- **Footer:** "Read from Mezo mainnet. MezoRoute executes on testnet until launch. Past results, not a forecast."
- **States:** loading shows a skeleton of the same height. Failure shows "Mainnet data unavailable." with Retry. If the history part fails alone (`backtests` null), the 30-day rows read "Unavailable" while the head rows still show.

## 4. Errors and edge cases

- History needs archive state, and the head multicall does not. They are fetched with `Promise.allSettled`, so one can fail without the other: a failed head read fails the whole card, while a failed history read fails only its rows.
- Script: an RPC error reading one event's pool state counts as `skipped: "pool state unavailable"`, with the reason printed. If more than half the events are skipped, the run fails, because the check would prove nothing.
- No new user-facing error decoding.

## 5. Testing

**Vitest:**
- `checkEntry`:
  - The S1 events already recorded in `entry.test.ts` pass the simulation to the wei, and are flagged not optimal (naive half).
  - A tampered `liquidityOut` gives a mismatch.
  - A wrong fee gives `feeOk` false.
  - A liquidity below `minLpOut` gives `withinSlippage` false.
  - The deviation sign and size are correct.
- `summarise`: counts, `passed` rules, and the more-than-half-skipped rule.
- `parseReference` and `referenceView`: mainnet token order, TVL, share, zero supply.
- `networks` has an `rpcUrl` per network.

**Live runs by me:**
- `npm run quote-accuracy` on all 14 testnet events. The result is recorded in this spec.
- `QUOTE_NETWORK=mainnet npm run quote-accuracy` prints the no-executor pass.

**QA by me:** local export with the keyless mock wallet on testnet. The card values must match independent `cast` reads against `rpc-internal.mezo.org`. Check the history-failure state (abort historical `eth_call` to the mainnet RPC), the head-failure state, that the card is absent on mainnet, and 360 px.

## Done when

- `npm test && npm run build` pass, the testnet quote-accuracy run passes, and agent QA passes.
- `PRODUCT_SPEC.md` §16 records F8. `CLAUDE.md` frontend notes cover the reference card (its own mainnet client, `rpcUrl`) and the quote-accuracy command.

### Quote-accuracy result (15 Oct 2026)

`npm run quote-accuracy` on testnet (head 16,164,987). Summary: `{ total: 14, checked: 14, skipped: 0, simulationMismatches: 0, feeMismatches: 0, outsideSlippage: 0, maxDeviationBps: 1, passed: true }`.
- **Simulation and fees:** every event's own swap simulated to the wei, and every fee was `musdIn × 10 / 10,000`.
- **Caller-chosen swaps** (5 events, all deviating 1 bps from the optimal quote): the first two entries (blocks 15,903,026 and 15,903,035, the second a borrow) and S1's three 1 MUSD entries.
- **App-sent swaps** (9 events, including two borrows): all deviated 0 bps.
- **Same-block activity:** none of the six second-in-block transactions had earlier pool activity in their block.
- **Mainnet:** `QUOTE_NETWORK=mainnet` printed "No executor on Mezo Mainnet yet: nothing to check."
- **Fixed while building it:** Vitest 5 hides console output of passing tests, so the script prints its report straight to stdout.

### QA result (15 Oct 2026): agent run passed

Local export with the keyless mock wallet (Playwright):
- **Testnet** (can-borrow account `0xe618…0D56`): "Mainnet today" is the last dashboard card, with a dashed border and the "Mainnet · reference only" badge. It showed:
  - Reserves 101,866 MUSD + 1.2505 BTC; value ≈203,670 MUSD; swap fee 0.3%.
  - "Fees 0.12% (≈1.5% a year, fees only)".
  - Deposits 14,172,031 MUSD, which is 47.4% of 29,871,966 MUSD.
  - "No liquidations reached the pool".
  - `cast` against `rpc-internal.mezo.org` returned the same reserves (101,866.83 MUSD, 1.25053 BTC), SP deposits (14,172,031.98), and MUSD supply (29,871,966.51).
- **History failure** (historical `eth_call` aborted): both 30-day rows read "Unavailable", and reserves, value, and deposits still showed.
- **Head failure** (every mainnet RPC request aborted): "Mainnet data unavailable." with Retry, while the route comparison above kept working. Retry without the interceptor filled the card.
- **Mainnet:** the card is absent.
- **360 px:** no horizontal scroll; the two halves stack.
- **Left for U1:** at 360 px, short labels such as "Swap fee" wrap onto two lines.

## Out of scope

Mainnet quote accuracy before M1; a chart; mainnet reference data on the mainnet dashboard; caching the script's results.
