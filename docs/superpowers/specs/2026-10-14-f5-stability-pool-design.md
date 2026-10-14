# F5 — Stability Pool route, position, and withdraw (design)

Date: 14 Oct 2026 · Task: F5 in `PRODUCT_SPEC.md` §16 · Depends on: F1, F2 (dashboard snapshot already reads the SP), F3/F7 patterns · Branch: `feat/f5-stability-pool`

## Goal

A user deposits wallet MUSD into the MUSD Stability Pool, sees the compounded deposit, the pending BTC gain, and what the position cost, claims the BTC gain, and withdraws any share back to MUSD (PRODUCT_SPEC §7 Flows E, F, H; FR-02, FR-08, FR-11, FR-17; §9 screens 2b, 3b, 5, 6b; §13 blocked-withdrawal row). The user approved this design on 14 Oct 2026.

## Decisions

| Topic | Decision |
|---|---|
| Calls | Direct protocol calls from the user (`provideToSP`, `withdrawFromSP`); the executor is not involved and no MezoRoute fee is charged (FR-18). |
| Authorisation | The Stability Pool has no permit entry point, so every wallet kind sends an exact MUSD approval to the pool, skipped when the allowance already covers the amount. |
| Pages | `/route/stability-pool/?amount=` (preview) → `/route/stability-pool/confirm/?amount=` (stepper), mirroring F3; `/positions/stability-pool/withdraw/?percent=` mirroring F7's exit page. |
| Withdraw amount | Presets 25 / 50 / 75 / Max. `amount = compounded × percent / 100`; Max is the exact compounded deposit (the contract sends `min(amount, compounded)`, and a compounded deposit never grows between read and send). |
| Claim BTC gain | `withdrawFromSP(0)`: pays the whole BTC gain and keeps the deposit. The contract skips the under-collateralised-Trove check for a zero amount, so Claim works while withdrawals are blocked; the blocked state offers it as the recovery action. |
| Move gain to Trove | Out of scope (`withdrawCollateralGainToTrove` needs Trove hints; little value for the demo). |
| Cost basis | Included. History comes from the Blockscout API of the network's explorer, not RPC log scanning (below). |
| Mainnet | Read-only until M1 through `writeBlocker`, like every other write. The 1,000 MUSD mainnet cap applies to the executor only, so the SP route has no cap. |

## Chain facts (14 Oct 2026, testnet)

- StabilityPool `0x1CCA7E410eE41739792eA0A24e00349Dd247680e`, created in block 4,518,674 (13 May 2025); the head is ≈16.1M. An RPC scan in 10,000-block chunks would need ≈1,160 requests, so F7's scanner is not usable here.
- The explorer is Blockscout. Its frontend (`explorer.test.mezo.org`) serves no API (`/api…` returns an HTML 404); the backend is `https://api.explorer.test.mezo.org` (mainnet `https://api.explorer.mezo.org`) with `access-control-allow-origin: *`. `GET /api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=<sp>&topic0=<event>&topic1=<depositor>&topic0_1_opr=and` returns one depositor's logs in ≈0.44 s. Blockscout returns at most 1,000 logs per call.
- Events: `UserDepositChanged(address indexed depositor, uint256 newDeposit)` (topic0 `0xbce78369…11c9`); `CollateralGainWithdrawn(address indexed depositor, uint256 collateral, uint256 MUSDLoss)` (topic0 `0x47647c49…5939`). `provideToSP` and `withdrawFromSP` emit `UserDepositChanged` then `CollateralGainWithdrawn`; `withdrawCollateralGainToTrove` emits them in the opposite order. `MUSDLoss = deposits[user] − compounded` before the action.
- `deposits(address)` is public and equals the `newDeposit` of the depositor's last `UserDepositChanged`.
- `withdrawFromSP(amount)`: `amount != 0` requires the lowest Trove's ICR ≥ MCR ("StabilityPool: Cannot withdraw while there are troves with ICR < MCR"); then requires `deposits[user] > 0` ("StabilityPool: User must have a non-zero deposit"); `provideToSP(0)` reverts with "StabilityPool: Amount must be non-zero". Withdrawals are open on testnet today (`withdrawFromSP(1)` from a depositor simulates).
- History fixture, depositor `0xe3b02b215085b99ce61e0f5ea9763ac637aa7826`: `newDeposit` 25 → 27 → 26 → 31 → 29 → 39 → 54 MUSD (blocks 14,973,621 … 15,439,988; two partial withdrawals), every gain and loss 0; `deposits` = compounded = 54 MUSD.
- Loss case on chain: depositor `0x4ddd70f4c603b6089c07875be02fedfd626b80af` has `deposits` 100,000,000 MUSD, compounded 86,231,160.82 MUSD, pending gain 176.22 BTC.
- `provideToSP` log layout (tx `0x9062b702bb46635dbf78b5aa55405e180fbb57093cc501ffa86d08fbe36c3cc6`, 15 MUSD; the depositor is a contract, whose own logs come first): MUSD `Approval` depositor → pool, pool `DepositSnapshotUpdated`, `UserDepositChanged`, `CollateralGainWithdrawn`, `StabilityPoolMUSDBalanceUpdated`, MUSD `Transfer` depositor → pool. A BTC gain is reported by `CollateralGainWithdrawn.collateral` (and `CollateralSent`); receipts do not rely on a BTC token `Transfer`.
- `cast estimate withdrawFromSP(1)` for a depositor with a gain: 225,416 gas. Real budgets come from QA transactions.

## 1. Pure modules (`src/lib/stability-pool/`)

- `history.ts`: `parseExplorerLogs(json)` → typed `UserDepositChanged` / `CollateralGainWithdrawn` rows (`blockNumber`, `logIndex`, `txHash`, values), rejecting a non-`"OK"` response unless it is Blockscout's "No logs found"; `spHistory(rows)` groups by transaction in `(blockNumber, logIndex)` order and yields actions `{ kind: "deposit" | "withdraw" | "claim", amount, gain, loss, depositAfter }` with `before = depositPrev − loss` and `delta = depositAfter − before` (positive deposit, negative withdraw, zero claim or move-to-Trove).
- `cost-basis.ts`: `spCostBasis(actions)` → `{ basis, gainsClaimed, lossRealised, lastDeposit }`. A deposit adds `amount`; a withdrawal removes basis pro rata, `basis × withdrawn / before` (the same rule as LP exits; a plain "deposits minus withdrawals" sum goes wrong once the deposit has absorbed a loss). `lastDeposit` must equal `deposits(user)`; otherwise the explorer has not indexed the latest action yet (lag).
- `position.ts`: `spPosition(snapshot, basis)` → compounded deposit, pending gain in BTC and MUSD, value now (`compounded + gain × price`), pending loss (`deposits − compounded`), and **estimated position value change** (`value now − basis`).
- `gate.ts`: deposit gate (`writeBlocker`; zero amount; amount above MUSD balance; not enough BTC gas) and withdraw gate (`writeBlocker`; no deposit; zero amount; not enough gas); `claimGate` (`writeBlocker`; no deposit; zero gain; gas).
- `steps.ts`: deposit steps `["approve", "deposit"]` or `["deposit"]` when the allowance covers the amount; withdraw and claim are one `send` step.
- `calls.ts`: `encodeApproveCall` (reusing F3's MUSD approve encoder), `encodeProvideCall(amount)`, `encodeWithdrawCall(amount)`; claim is `encodeWithdrawCall(0n)`.
- `receipt.ts`: `findSpReceipt(logs, network, account)` → `{ kind: "sp-deposit" | "sp-withdraw" | "sp-claim", amount, gain, loss, depositAfter }` from the pool's `UserDepositChanged` and `CollateralGainWithdrawn` plus the MUSD `Transfer` between the account and the pool (account → pool: deposit; pool → account: withdraw; none: claim).
- `withdraw-intent.ts`: `percent` (25/50/75/100, default 100) parsed from and written to the URL.
- `src/lib/quote/gas.ts`: `SP_APPROVE_GAS`, `SP_DEPOSIT_GAS`, `SP_WITHDRAW_GAS` from measured QA transactions, used through the existing `gasLimit` rule.

## 2. Data

- **Snapshot** (`src/lib/stability-pool/snapshot.ts`), one multicall with the selected network's `chainId`: block number and timestamp; `getCompoundedMUSDDeposit(user)`, `getDepositorCollateralGain(user)`, `deposits(user)`; MUSD `balanceOf(user)` and `allowance(user, pool)`; the price feed; the account's BTC balance for gas. The route, confirm, positions, and withdraw pages read it; it refetches every 15 s and after each confirmed transaction.
- **History** (`src/lib/stability-pool/explorer.ts`, `useSpHistory`): `NetworkConfig` gains `explorerApiUrl` (testnet `https://api.explorer.test.mezo.org`, mainnet `https://api.explorer.mezo.org`). Two requests (one per event, filtered by `topic1` = the padded account); when a response holds 1,000 logs, it asks again from the last block (deduplicated by `txHash` + `logIndex`). No cache. Fetch errors and timeouts (10 s) show "Unavailable" with Retry; a lag (`lastDeposit ≠ deposits(user)`) shows "Updating…" and refetches after 15 s, at most 4 times, then "Unavailable". History never blocks the page.

## 3. UI

- **`/route/stability-pool/`** (screen 2b): amount form (Max = wallet MUSD); rows: your deposit now, pending BTC gain "paid to your wallet with this deposit", deposit after; exposure before/after (Trove, LP, SP pending BTC, from the exposure module); risks in one sentence each (deposit shrinks when it absorbs liquidated debt; withdrawals pause while any Trove is under-collateralised; BTC gains arrive only after liquidations); "No MezoRoute fee". CTA Review.
- **`/route/stability-pool/confirm/`** (screen 3b): exact amounts; stepper Approve MUSD (when needed) → Deposit; before sending, refresh the snapshot, re-gate, and simulate `provideToSP`; then `/tx/?hash=`.
- **Receipt `/tx/`**: `receiptKind` gains `sp-deposit` ("Deposit confirmed": MUSD deposited, BTC gain paid, deposit loss realised, deposit now), `sp-withdraw` ("Withdrawal confirmed": MUSD withdrawn, BTC gain paid, loss realised, deposit now), and `sp-claim` ("BTC gain claimed"). Executor events keep priority.
- **`/positions/`** (screen 5): a Stability Pool card under the LP cards: compounded deposit; pending BTC gain (BTC and MUSD); cost basis; estimated position value change; BTC gains claimed and deposit loss realised (from history); buttons **Withdraw** (→ withdraw page) and **Claim BTC gain** (simulated, then sent; disabled when the gain is zero). The empty state links to both routes.
- **`/positions/stability-pool/withdraw/`** (screen 6b): percent presets; rows: MUSD to withdraw, deposit after, BTC gain paid with it, "No fee"; the call is simulated on load and before sending. A blocked simulation shows the §13 message "Withdrawals are paused while some Troves are under-collateralised." with **Claim BTC gain** and Retry.
- **Dashboard**: `ReadinessCard` gains "Back the system" → `/route/stability-pool/` next to the LP actions. The LP vs SP comparison is F6.

## 4. Errors

`revert-strings.ts` gains: "Cannot withdraw while there are troves with ICR < MCR" → `SP_WITHDRAW_BLOCKED` (recoveries: Claim BTC gain, Retry); "User must have a non-zero deposit" → `NO_SP_DEPOSIT`; "Amount must be non-zero" → `AMOUNT_TOO_SMALL` (existing outcome). Pre-send gate outcomes reuse F3/F7 ones (`INSUFFICIENT_BALANCE`, gas, `writeBlocker`) plus `NOTHING_TO_CLAIM` from F7.

## 5. Testing

**Vitest:** `parseExplorerLogs` (real Blockscout JSON, "No logs found", error responses); `spHistory` replays the `0xe3b0…7826` fixture to 54 MUSD with two withdrawals; `spCostBasis` (deposit only; partial withdraw pro rata; deposit after a loss; claim leaves basis; move-to-Trove ordering; lag detection); pagination at 1,000 rows with duplicates; `spPosition` value and value change; gates in order with boundaries; steps by allowance; call encoding round-trips; `findSpReceipt` on the live `0x9062…` logs (deposit 15 MUSD, deposit after 54) and on synthetic withdraw/claim logs; revert strings; withdraw intent round-trip.

**QA by me:** local export + local signer (deployer): deposit 10 MUSD with approval (receipt = events; allowance back to 0), positions card against chain reads and an independent history recount, Claim (zero gain → disabled), withdraw 50% and Max; gas measured for the constants; blocked state via a mocked simulation revert; Unisat mock shows Approve first; mainnet read-only; 360 px.

**QA by the user:** MetaMask on the Vercel preview: deposit → receipt → positions → withdraw 25%.

## Done when

- `npm test && npm run build` pass; both QA runs pass with receipts matching the events.
- `PRODUCT_SPEC.md`: §12 SP cost basis rule (pro rata) and history source (explorer API), §16 records F5.
- `CLAUDE.md` frontend notes cover the SP route, the explorer API, and Claim via `withdrawFromSP(0)`.

## Out of scope

Borrow → Stability Pool in one transaction (deposits are keyed to `msg.sender`); `withdrawCollateralGainToTrove`; the LP vs SP comparison (F6); a history cache; mainnet writes before M1.
