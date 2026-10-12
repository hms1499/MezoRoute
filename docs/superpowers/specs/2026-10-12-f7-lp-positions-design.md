# F7 — LP positions, fee claims, and exit (design)

Date: 12 Oct 2026 · Task: F7 in `PRODUCT_SPEC.md` §16 · Depends on: F3 (`2026-10-05-f3-lp-route-design.md`) · Branch: `feat/f7-lp-positions`

## Goal

A user who holds MUSD/BTC LP sees what it is worth, what it cost, and what fees it has earned; claims those fees in one transaction; and exits any share of the LP back to MUSD in one `exit` transaction (PRODUCT_SPEC §7 Flows F, G, G2; FR-08, FR-09, FR-10, FR-24; §9 screens 5 and 6a). The user approved this design on 12 Oct 2026.

## Decisions

| Topic | Decision |
|---|---|
| Scope | LP only. The Stability Pool position and withdraw (screen 6b, Flow H) move to F5, which adds an SP block to `/positions`. PRODUCT_SPEC §16 is updated. |
| Position reads | One multicall snapshot per page, as in F2/F3: every value comes from one block. |
| Claimable fees | Computed locally from `claimable0/1`, `index0/1`, and `supplyIndex0/1(user)`, mirroring `Pool._updateFor`, so they come from the snapshot's block. QA checks them against an `eth_call` of `claimFees()` from the user (the spec §12 method). |
| Cost basis | From the executor's `Entered` (filtered by `recipient`) and `Exited` (filtered by `caller`, whose LP is pulled) logs, read over RPC in 10,000-block chunks and cached in `localStorage`. No third-party indexer. |
| Exit page | One page, `/positions/lp/exit/?percent=&slippage=`: amount, preview, and stepper together; the inputs lock once the first step starts. |
| Exit amount | Presets 25 / 50 / 75 / Max (100). `liquidityIn = balance × percent / 100`; Max is the exact balance. |
| Wallets | EOA: LP permit → `exit`. Smart account: exact LP approval → `exit`. The first step is skipped when the allowance covers `liquidityIn`. Claim is a direct `Pool.claimFees()` call for both. |
| Mainnet | Read-only until M1: Claim and Exit go through `writeBlocker`, like every other write. |

## Chain facts (12 Oct 2026, testnet)

- LP permit: the pool is OpenZeppelin `ERC20Permit("")`; `eip712Domain()` returns name `""`, version `"1"`; `keccak(EIP712Domain, keccak(""), keccak("1"), 31611, pool)` equals `DOMAIN_SEPARATOR()` = `0x4f95…7131`. Nonce: `pool.nonces(owner)`.
- `Pool.burn` pays `liquidity × balance / totalSupply` per token, using the pool's **token balances**, not reserves, and reverts with `InsufficientLiquidityBurned` when either amount is zero. After the burn, reserves equal the new balances; the BTC→MUSD swap runs on those.
- `claimFees()`: `_updateFor(sender)` adds `balance × (index − supplyIndex) / 1e18` to `claimable`, then pays and emits `Claim(sender, sender, amount0, amount1)` only when either is non-zero. LP transfers call `_updateFor` on both sides, so fees accrued before an exit stay claimable after it.
- Deployer `0xd74f…2B49`: `claimFees()` simulated returns (73,915,791,430; 3,690,796) = `claimable0/1`.
- `eth_getLogs`: at most 10,000 blocks per request; **a range whose `toBlock` is above the head returns an empty list without an error** (block 16,112,209 holds an `Entered` log, but 16,103,010–16,113,009 returned none while the head was 16,112,290). Every range is clamped to the head. A full scan from the executor's deployment block 15,903,010 took 21 requests, 7.4 s at concurrency 6.
- Archive reads work: the pool state at block 15,903,030 is readable.
- Live exit, the replay fixture: tx `0x38a45ffe6b97b99ce6b5207c90878b02f969e35d30c1caa914425c04e9b17e30`, block 15,903,031, gas 350,049 (approval, no permit). `Exited`: liquidityIn 71,164,200,333,222,588; musdRemoved 19,972,003,253,167,101,669; btcRemoved 253,582,349,184,825; musdFromSwap 19,964,010,567,181,212,457; musdOut 39,936,013,820,348,314,126; btcRefund 0. Pool at block 15,903,030: reserves = balances = (MUSD 102,598,256,665,495,665,120,330,482; BTC 1,302,678,885,923,892,497,596), totalSupply 365,577,894,146,642,543,892,826.

## 1. Pure modules

- `src/lib/quote/exit.ts`: `simulateExit(pool, liquidityIn)` → `{ musdRemoved, btcRemoved, musdFromSwap, musdOut }`, exact integer mirror of `burn` (on balances) and the BTC→MUSD swap on post-burn reserves (reusing the entry engine's swap function); `exitMinimums(quote, slippageBps)` → the four `ExitParams` minimums; `exitPriceImpact(...)`. Zero removal on either side → `null` (blocked as amount too small).
- `src/lib/positions/fees.ts`: `claimableFees(state)` → `{ musd, btc }`, mirroring `_updateFor`, mapped by token address.
- `src/lib/positions/history.ts`: `scanRanges(from, head, size)` (clamped to the head); `fetchExecutorEvents(read, input)` with an injected log reader, concurrency 6, per-chunk retry; cache merge (`{ scannedTo, events }`, keyed by network + executor + account; stores only up to head − 50 so a re-org cannot leave stale events).
- `src/lib/positions/cost-basis.ts`: `costBasis(events, lpBalance)` → `{ attributedLp, basis, fees, unattributedLp, coveredLp, coveredBasis }`. Entry adds `musdIn − musdRefund − btcRefund × musdSwapped / btcFromSwap`; the execution fee is part of it and summed separately. Exit removes basis pro rata by LP. If the wallet holds more LP than attributed, the excess has no cost basis; if less, the basis is scaled to the balance.
- `src/lib/positions/exit-intent.ts`: `percent` (25/50/75/100, default 100) and `slippage` (reusing F3's presets) parsed from and written to the URL.
- `src/lib/positions/exit-gate.ts`, `exit-steps.ts`, `exit-params.ts`, `exit-preview.ts`: the exit counterparts of F3's gate, steps (`permit|approve`, `exit`), params (`buildExitParams`, `encodeExitCall`, `encodeLpApproveCall`), and preview.
- `src/lib/quote/gas.ts`: `EXIT_GAS` from the QA measurement (live baseline 350,049 without permit).

## 2. Data

`src/lib/positions/snapshot.ts`, one multicall: the block number and timestamp; LP `balanceOf(user)`, `totalSupply`, `getReserves`, the pool's MUSD and BTC balances, `PoolFactory.getFee(pool, false)`, `token0`; `index0/1`, `supplyIndex0/1(user)`, `claimable0/1(user)`; LP `allowance(user, executor)` and `nonces(user)`; the price feed (for BTC values). The network config's executor gains `deployBlock` (testnet 15,903,010). History is fetched by `usePositionsHistory` alongside the snapshot and never blocks the page: cost-basis rows show a loading state, then the value or "Unavailable" with Retry.

## 3. UI

- **`/positions/`** (screen 5):
  - LP card: LP balance and pool share; underlying MUSD and BTC; "If you exit everything now" (the full-exit quote's expected MUSD); cost basis with the fee line; **Estimated position value change** (exit value of covered LP − covered basis), never "profit" or "APY"; a note for LP without cost basis. Exit button → `/positions/lp/exit/`.
  - Fees card: claimable MUSD and BTC (BTC also in MUSD); **Claim** (simulated, then sent; disabled when both are zero); shown even when the LP balance is zero.
  - Empty state (no LP, no fees): link to `/route/lp/`.
- **Header**: a "Positions" link. **Dashboard**: a positions summary card (LP value, claimable fees) linking to `/positions/`.
- **`/positions/lp/exit/`** (screen 6a): percent presets; preview rows (LP to exit, MUSD and BTC removed, BTC swapped to MUSD, expected and minimum MUSD, price impact, gas, "No exit fee", "Unclaimed fees stay claimable after you exit"); risks; stepper (sign LP permit / approve LP → send exit). Send: refresh, re-gate, re-check the permit deadline, simulate `exit`, submit, go to `/tx/`.
- **Receipt `/tx/`**: decodes `Entered` (as now), `Exited` ("Exit confirmed": LP exited, MUSD and BTC removed, MUSD from swap, MUSD received, BTC returned), or the pool's `Claim` ("Fees claimed": MUSD and BTC). "View positions" link.

## 4. Errors and blocks

Exit gate order: no executor / wrong network (`writeBlocker`), no LP, LP balance below the pinned amount (`LP_CHANGED`), zero removal (amount too small), price impact above 5%, not enough gas, stale quote (60 s); at send, an expired permit resets to the permit step. Claim: `writeBlocker`, nothing to claim, not enough gas. Tigris (`InsufficientLiquidityBurned`, …) and executor (`InsufficientFinalOutput`, …) reverts already decode; new outcomes only where a pre-send check needs one (`NO_LP`, `LP_CHANGED`, `NOTHING_TO_CLAIM`).

## 5. Testing

**Vitest:** `simulateExit` replays the live `Exited` above to the wei; minimums and price impact; `claimableFees` (zero balance, index delta, token order on mainnet); `scanRanges` clamps to the head (regression for the silent empty result); cache merge and the head − 50 margin; `costBasis` (one entry, partial exit pro rata, LP without basis, balance below attributed, BTC refund); exit intent round-trip; gate order and boundaries; steps per wallet kind and allowance; `encodeExitCall` round-trip; LP permit typed data recovers a signature made with the verified domain; receipt decoding for `Exited` and `Claim` from live logs.

**QA by me:** local export + local signer with the deployer: the positions page against chain reads (claimable = `claimFees()` simulation); exit 50% of the deployer's LP with a permit, `Exited` = quote at the previous block, allowance 0, executor balances 0; claim fees, `Claim` = computed claimable; Bitcoin-wallet mock shows the approve path; the history cache survives a reload; 360 px.

**QA by the user:** MetaMask on the Vercel preview: positions → Claim → receipt; Exit 25% → permit → send → receipt.

## Done when

- `npm test && npm run build` and `forge test` pass; both QA runs pass with a live `Exited` matching its quote.
- `PRODUCT_SPEC.md`: F7 scope (LP), SP withdraw under F5, §11.5/§12 note on `burn` using balances and the `eth_getLogs` head clamp, §16 records F7.
- `CLAUDE.md` frontend notes cover positions, history scanning, and the LP permit domain.

## Out of scope

Stability Pool position and withdraw (F5); gauge staking (spec §4: gauges pay BTC, not in scope); exit to BTC or to both tokens; LP received from outside MezoRoute gets a value but no cost basis.
