# L1: Unwind, Close and Leverage (design)

Date: 7 Nov 2026 · Wave 2, third item (after G1) · Deadline 13 Nov 2026 · Branch: `feat/l1-unwind-leverage` · Inputs: `PRODUCT_SPEC.md` §11.9 and §16 (W2-1…W2-5), `docs/wave2/2026-11-04-wave1-feedback.md`, research of the projects that already ship this on Mezo (below).

## Why

The Wave 1 judge named the next step directly: "add the planned leverage and unwind with redemption-risk handling, which would move it toward a new MUSD use rather than a router over existing ones." Three other Wave 1 projects (Pylon, Coil, Mezodot) already ship one-transaction leverage, so leverage alone is not a differentiator; what the reviews rewarded and punished is how the edge cases are handled (list below). MezoRoute's angle stays the same as for the LP route: one honest preview of what the user gets, the risks in plain words, then one transaction, with no custody and no admin.

The user delegated the research and the design calls (7 Nov). The user's decisions:

- **Mainnet:** deploy and verify the contract with small caps, no real-money round trip by the team; Unwind, Close and Leverage are **open to users and judges** on mainnet. The real demo runs on testnet. (The user has 0.05 BTC; a minimum Trove of 2,000 MUSD debt on 0.05 BTC sits near 195% CR, below the 200% leverage floor, so a mainnet round trip would not even be possible at that size.)
- Order and scope as proposed in chat: Unwind, then Close, then Leverage; exits free; EOAs only.

## What we learned from the projects that ship this

| Project | What it does | What we take |
|---|---|---|
| **Coil** (Wilivms/Coil) | User-owned Trove, every action through `BorrowerOperationsSignatures`, flash swap on the MUSD/BTC pool. Every swap bounded by `PriceFeed` (3% default, 5% hard cap). Refinance when capacity is short. One-click claim of surplus BTC after a redemption. Recovery Mode: new leverage blocked, MUSD repayment still offered. Zero Coil fee on every risk-reducing action. | Nearly all of it: the oracle bound, the refinance step, the claim, the Recovery Mode behaviour, free exits. |
| **Pylon** (PhiBao/pylon-mezo) | Loop, Unwind, Exit (close the Trove from its own collateral with 0 MUSD in the wallet), a redemption radar (the user's place in the redemption queue). Lost points for an un-timelocked admin setter. Found that nested flash paths starve inner frames of gas and that Mezo's estimator fails on them. | Close from collateral, the redemption queue figure, an explicit gas budget, no admin. |
| **Mezodot** | Its own lending markets and oracles; a BTC long through a Tigris flash swap. | Little; confirms the Tigris flash swap works for this. |
| **Liquity v2 zappers, DeFi Saver** | `leverUpTrove` / `leverDownTrove` / close-to-collateral through a flash loan, excess returned to the user; the ChainSecurity audit flagged missing callback access control and unreturned swap excess. | Callback authentication and "nothing stays in the contract" as tested invariants. |

What the Wave 1 reviews marked down (from `docs/wave2/2026-11-04-wave1-feedback.md`), and where this design answers it:

| Review point | Answer here |
|---|---|
| `maxBorrowingCapacity` | Checked in the quote; a Refinance step when it is the only blocker (§ App, Leverage). |
| Recovery Mode: a way out, no withdrawal assumption under 150% TCR | All three actions blocked with the reason; Repay from wallet offered (§ Recovery Mode). |
| Pending redistribution debt not double-counted | One read of `getEntireDebtAndColl`, as the dashboard already does. |
| `claimCollateral` after a redemption | Claim card when `CollSurplusPool` holds BTC for the account. |
| Swap minimums from `PriceFeed`, not the pool's spot quote | Contract-enforced oracle bound on every flash swap. |
| Admin paths over user funds | None: immutable, no owner, no pause, no setter. |
| Explorer verification, real wallets | Both networks verified; real testnet round trips with the user's MetaMask. |

## Chain facts (7 Nov 2026)

Read live this session (`cast`), and from `mezo-org/musd` `BorrowerOperations.sol` / `BorrowerOperationsSignatures.sol` / `TroveManager.sol`:

| | Testnet | Mainnet |
|---|---|---|
| MUSD/BTC pool reserves | 102.5M MUSD + 1,304 BTC | 37.1k MUSD + 0.483 BTC |
| Pool mid price vs `PriceFeed.fetchPrice()` | 78,609 vs 75,816 (pool **3.7% above** the oracle) | 76,886 vs 75,816 (pool 1.4% above) |
| Pool fee (`PoolFactory.getFee`) | 4 bps | 30 bps |
| Troves (`SortedTroves.getSize`) | 367 | 4 |
| Minimum net debt | 1,800 MUSD (+200 MUSD gas compensation) | same |

Protocol rules that shape the design:

- **Borrowing capacity only shrinks.** `maxBorrowingCapacity = coll × price / 1.10` is set at open and at `refinance`; adding collateral does **not** raise it, withdrawing collateral lowers it to `min(current, new)`. Any debt increase must keep `debt + increase + fee ≤ capacity`.
- **Refinance** (`BorrowerOperations.refinance(upperHint, lowerHint)`, callable by the borrower directly) resets the capacity from the current collateral and price, moves the Trove to the current global interest rate, and charges the borrowing fee on 20% of the net debt (≈ 0.02% of debt at the 0.1% rate). Blocked in Recovery Mode.
- **Recovery Mode** (TCR < 150%): no collateral withdrawal, no close, no refinance; a debt increase is only allowed with a collateral top-up that leaves ICR ≥ 150% and raises it. Pure MUSD repayment and pure top-up stay open.
- **Close** burns `debt − 200` MUSD from the **caller** and returns all collateral to `recipient`; the 200 MUSD gas compensation is burned from the gas pool. It is blocked in Recovery Mode and when the close itself would push TCR under 150%.
- **Adjust** with a repayment burns the MUSD from the **caller** (`BorrowerOperationsSignatures` passes `msg.sender`), so the executor must hold the flashed MUSD itself (Pylon's live revert: "Caller doesnt have enough mUSD to make repayment").
- `TroveManager.updateSystemAndTroveInterest(borrower)` is public. After it, the Trove's debt within the same transaction is exact.
- `BorrowerOperationsSignatures` keeps **one nonce per user** for all its signature types; `recipient` may not be the active pool or the coll surplus pool.
- Tigris `Pool.swap(amount0Out, amount1Out, to, data)` is a standard optimistic flash swap: it transfers out, calls `IPoolCallee(to).hook(sender, amount0Out, amount1Out, data)`, then checks K on its balances. Paying the **other** token back inside the hook is valid (Coil does exactly this on the same pool). Calling `swap` on the same pool again inside the hook is not (re-entrancy lock; Pylon's finding).
- On Mezo the BTC ERC-20 balance and the native balance are one ledger, so BTC received from the pool can be sent as `msg.value`. This cannot be reproduced with a mock ERC-20 (`PRODUCT_SPEC.md` §11.9 "Testing constraint").

## Goals

- A borrower can **Unwind** (sell part of their collateral to repay part of their debt), **Close** (repay all debt from collateral, BTC back to the wallet) and **Leverage** (add BTC to the Trove, paid for by new debt), each in **one transaction**, with no MUSD needed in the wallet for Unwind and Close.
- Every preview shows: collateral and debt before → after, CR before → after, liquidation price, MezoRoute fee (0 on Unwind and Close), borrowing fee, pool fee and price impact, the pool-vs-oracle gap, BTC exposure change, and the user's place in the redemption queue before → after.
- The edge cases from the review table above are handled and shown, not just reverted.
- A user **without a Trove** can open one at leverage from BTC alone in one transaction (`openLeveraged`). It is in the contract from day one because the contract is immutable; mainnet has 4 Troves, so without it almost nobody (judges included) could use Leverage.
- Every Confirm page leads with **the cost against the oracle price** (what the swap pays compared with `PriceFeed`), because the pools are thin: on 7 Nov reserves, a mainnet Leverage at the cap costs ≈ 4.4%, a mainnet Close of a minimum Trove ≈ 3.8% (≈ $70), a small mainnet Unwind ≈ 0.6% better than the oracle, and a testnet Leverage ≈ 3.7% (the pool/oracle gap).
- Live testnet round trips of all three with the user's MetaMask; mainnet deployed and verified with caps.

## Non-goals

- The **Open with leverage page** is a stretch goal (built last, only if time allows); `openLeveraged` itself is in the contract from the start (below).
- Keepers, automation, triggers (Coil's Guard/Shield/Recoil, Pylon's Shield reserve).
- Refinance inside the leverage transaction (a second signature on nonce + 1). It is a separate, direct step instead.
- Bitcoin wallets (OrangeKit Safes). `BorrowerOperationsSignatures` verifies a plain ECDSA signature, as in F4.
- A mainnet real-money round trip (user's decision).
- Interest-rate optimisation, hint caching, a multi-collateral future.

## Anti-goals

- Any owner, pause, setter, upgrade path, or stored allowance the contract can spend later.
- Any MUSD or BTC left in the contract after a call; any payout from balances it held before.
- A swap price taken only from the pool (sandwichable).
- A Trove action whose recipient is anyone but the borrower.
- Promising that leverage is profitable, or calling a redemption a "loss" or "safe" without the mechanism.
- Hiding that testnet's pool sits ~3.7% above the oracle: leverage on testnet pays that gap.

## Contract: `MezoRouteLeverage`

A new immutable contract, separate from `MezoRouteExecutor` / `MezoRouteExecutorV2` (both untouched). Same toolchain and rules as the executors (Solidity 0.8.24, London, OZ 4.9.0, ReentrancyGuard, balance-delta accounting, SafeERC20).

### Immutables

`musd`, `btc`, `pool` (the MUSD/BTC volatile pool, checked against `PoolFactory.getPool` in the constructor as V2 does through the Router), `factory` (pool fee), `borrowerOperationsSignatures`, `troveManager` (exact debt, post-condition ICR, Recovery Mode check), `priceFeed` (oracle bound), `feeBps` (≤ 50, applied to Leverage only), `feeRecipient`, `maxBtcFlash` (per-transaction cap on the BTC a Leverage flashes), `maxMusdFlash` (per-transaction cap on the MUSD an Unwind or Close flashes).

Constants: `MAX_DEVIATION_BPS = 1_000` (hard cap on the user's oracle bound), `MIN_CR_FLOOR = 1.5e18` (Leverage rejects a `minCollateralRatio` below CCR; the app's floor is 200%).

Caps per network (`Deploy` script, as `maxMusdInFor`): testnet `maxBtcFlash` 12 BTC, `maxMusdFlash` 1,000,000 MUSD; mainnet 0.0125 BTC and 2,500 MUSD (2,500 lets a minimum Trove close; pool depth and the oracle bound decide whether a given size is possible).

### Shared mechanics

- `borrower = msg.sender` always; every BOS call passes `borrower = recipient = msg.sender`.
- The hook accepts a call only when `msg.sender == pool`, `sender == address(this)`, and an operation started by this contract is in flight (a storage flag set before `pool.swap` and cleared after; London has no transient storage). The operation's parameters travel in `data`.
- **Exact pool input.** The amount paid back to the pool is the smallest input the pool's K check accepts for the flashed output, computed on-chain from the reserves read at the start of the call and the factory fee (volatile `x·y` with the fee taken on input). Tests check it to the wei against the real Tigris Pool in `TigrisHarness`, including that one wei less reverts.
- **Oracle bound.** The effective swap price is compared with `priceFeed.fetchPrice()` read in the same call, one-sided (only a worse price than the oracle fails): Leverage requires `musdToPool ≤ btcFlashed × price × (1 + maxDeviationBps)`; Unwind and Close require `btcToPool ≤ musdFlashed / price × (1 + maxDeviationBps)`. `maxDeviationBps ≤ MAX_DEVIATION_BPS` is a user parameter. The signed Trove amounts remain the user's exact slippage guard; the oracle bound stops a quote built on a manipulated pool.
- **Payment from the wallet.** The leg that repays the pool is paid from the user's wallet. The contract pulls the user's signed maximum (`maxBtcToPool`, or `maxMusdToPool + fee` for Leverage) with `transferFrom` after an optional EIP-2612 permit for exactly that maximum (wrapped in try/catch as in V2; `Permit.value = 0` means use the existing allowance), pays the pool the exact input (and the fee), and refunds the rest to the user in the same call. A permit for the maximum therefore ends at a zero allowance, as `PRODUCT_SPEC.md` §11.8 requires. The contract never approves anything.
- **Balances.** MUSD and BTC balances are snapshotted at entry; at the end each must equal its start value (the contract keeps nothing and pays nothing from earlier balances). Every reported amount is a delta.
- `nonReentrant` on the three entry points; deadline checks; `ZeroAmount`, `AmountAboveCap`, `Expired` errors as in V2.

### `unwind(UnwindParams p, Permit btcPermit)`

User intent: "repay `debtToRepay` by selling collateral; withdraw `collWithdrawal`". The app sets `collWithdrawal` = the quoted BTC the pool needs × (1 + slippage), so a small BTC remainder lands in the wallet.

1. Validate: `debtToRepay > 0`, `debtToRepay ≤ maxMusdFlash`, deadline, `maxDeviationBps` within the cap.
2. `pool.swap(musdOut = debtToRepay, to = this, data)`. In the hook:
   1. `adjustTroveWithSignature(collWithdrawal, debtToRepay, isDebtIncrease = false, assetAmount = 0, hints, borrower, recipient = borrower, signature, deadline)`. The repayment is burned from this contract's flashed MUSD; the withdrawn BTC goes to the borrower.
   2. Compute `btcToPool` (exact input); require `btcToPool ≤ p.maxBtcToPool` and the oracle bound.
   3. Permit + pull `p.maxBtcToPool` from the borrower, pay `btcToPool` to the pool, refund `maxBtcToPool − btcToPool` to the borrower.
3. Balance checks; emit `Unwound(borrower, debtRepaid, collWithdrawn, btcToPool)`.

No MezoRoute fee. The resulting net debt must stay ≥ 1,800 MUSD (the protocol enforces it; the app routes a larger repayment to Close). Withdrawing collateral also lowers the Trove's borrowing capacity (protocol rule); the preview says so.

Front-run argument (unchanged from `PRODUCT_SPEC.md` §11.9): anyone who submits the user's signature must repay the debt themselves, and the BTC still goes to the borrower; our call then reverts on the used nonce and nothing is lost.

### `close(CloseParams p, Permit btcPermit)`

1. Validate deadline and deviation cap.
2. `troveManager.updateSystemAndTroveInterest(borrower)`; read the Trove's debt; `musdNeeded = debt − 200 MUSD`; require `musdNeeded ≤ maxMusdFlash`.
3. `pool.swap(musdOut = musdNeeded, to = this, data)`. In the hook: `closeTroveWithSignature(borrower, recipient = borrower, signature, deadline)` (burns `musdNeeded` from this contract; all collateral to the borrower); compute `btcToPool`; require `≤ p.maxBtcToPool` and the oracle bound; permit + pull `p.maxBtcToPool`, pay `btcToPool` to the pool, refund the rest.
4. Balance checks; emit `Closed(borrower, debtRepaid, collReturned, btcToPool)`.

No MezoRoute fee. Interest accrues every second, so the app quotes with a small margin in `maxBtcToPool`; the contract pays the exact amount.

### `leverage(LeverageParams p, Permit musdPermit)`

User intent: "add `btcToAdd` to my Trove and borrow `debtIncrease` to pay for it; my CR must end ≥ `minCollateralRatio`".

1. Validate: `btcToAdd > 0`, `btcToAdd ≤ maxBtcFlash`, deadline, deviation cap, `minCollateralRatio ≥ MIN_CR_FLOOR`.
2. `pool.swap(btcOut = btcToAdd, to = this, data)`. In the hook:
   1. `adjustTroveWithSignature{value: btcToAdd}(collWithdrawal = 0, debtIncrease, isDebtIncrease = true, upperHint, lowerHint, borrower, recipient = borrower, signature, deadline)`. The function has no `assetAmount` argument: the signature binds `msg.value` in that slot, so the user signs `assetAmount = btcToAdd` and the contract must send exactly `btcToAdd`. MUSD is minted to the **borrower**.
   2. Compute `musdToPool` (exact input) and `fee = musdToPool × feeBps / 10_000`; require `musdToPool ≤ p.maxMusdToPool`, `p.maxMusdToPool + fee ≤ debtIncrease`, and the oracle bound.
   3. Permit + pull `p.maxMusdToPool + fee` from the borrower, pay `musdToPool` to the pool and `fee` to `feeRecipient`, refund the rest.
3. Post-condition: `troveManager.getCurrentICR(borrower, price) ≥ minCollateralRatio`. Balance checks; emit `Leveraged(borrower, btcAdded, debtIncrease, musdToPool, fee, musdSurplus)` where `musdSurplus = debtIncrease − musdToPool − fee` stays in the borrower's wallet.

The borrowing fee (0.1% of `debtIncrease`) is added to the Trove's debt and minted to the PCV by the protocol (`BorrowerOperations.sol` `_triggerBorrowingFee`); the user does not pay it from the wallet. The capacity check is `debt + debtIncrease + fee ≤ maxBorrowingCapacity`. The preview shows the fee.

### `openLeveraged(OpenLeveragedParams p, Permit musdPermit)` (payable)

User intent: "open a Trove with my `msg.value` BTC plus `btcToFlash` from the pool, borrowing `debtAmount`; CR must end ≥ `minCollateralRatio`". For a user with no Trove (`TroveManager` status not active; the protocol also enforces it).

1. Validate: `msg.value > 0`, `btcToFlash > 0`, `btcToFlash ≤ maxBtcFlash`, deadline, deviation cap, `minCollateralRatio ≥ MIN_CR_FLOOR`.
2. `pool.swap(btcOut = btcToFlash, to = this, data)`. In the hook:
   1. `openTroveWithSignature{value: msg.value + btcToFlash}(debtAmount, upperHint, lowerHint, borrower, recipient = borrower, signature, deadline)`. The signature binds `assetAmount = msg.value + btcToFlash`, `debtAmount`, `borrower`, `recipient`. MUSD is minted to the borrower.
   2. Exact `musdToPool`, `fee`, the oracle bound and the pull-maximum-and-refund payment exactly as in `leverage`.
3. Post-condition ICR ≥ `minCollateralRatio`; balance checks (the start snapshot is taken after `msg.value` is credited, so the expected end balance is start − `msg.value`); emit `OpenedLeveraged(borrower, btcFromUser, btcFlashed, debtAmount, musdToPool, fee, musdSurplus)`.

The protocol's minimum (1,800 MUSD net debt) applies: `debtAmount` may exceed what the pool needs, and the surplus stays in the wallet. On mainnet the 0.0125 BTC cap pays for ≈ 950 MUSD, so a mainnet open at leverage needs `debtAmount ≥ 1,800` with the rest as surplus and enough of the user's own BTC to stay ≥ 200% (≈ 0.045 BTC on 7 Nov). The front-run argument is the leverage one: whoever submits the signature must supply the bound BTC, and the Trove and its MUSD belong to the borrower.

### Tests and audit

- Unit tests per path with the real Tigris Pool (`TigrisHarness`) and a mock `BorrowerOperationsSignatures` / `TroveManager` / `PriceFeed`, following the V2 test layout under `test/leverage/`. **BTC in these tests is a unified mock** whose `balanceOf` is the account's native balance and whose `transfer`/`transferFrom` move native balance (through the `vm.deal` cheatcode inside the mock), so the pool's ERC-20 transfer to the contract and the contract's `msg.value` send hit one ledger as on Mezo, and the end-of-call balance check runs locally unchanged. (This replaces `PRODUCT_SPEC.md` §11.9's "mock BOS funded with `vm.deal`", which funds the wrong party.) The smoke run still proves the real precompile.
- Invariant suite (`test/invariant/`): random sequences of the three actions, pool moves and oracle moves; the contract never holds MUSD or BTC after a call, never owns a Trove, never pays out a pre-existing balance, and the hook is unreachable from outside an operation.
- `openLeveraged` gets the same unit and invariant coverage as `leverage`, plus: a borrower who already has a Trove, `msg.value` that does not match the signed `assetAmount`, and the minimum net debt.
- Negative tests: hook from a non-pool caller, from the pool outside an operation, `sender ≠ this`; recipient games; oracle bound both directions; one wei less to the pool; cap edges; expired deadline; used nonce; permit already spent (falls back to allowance and reverts cleanly without one).
- `contracts/SELF_AUDIT.md` gains a `MezoRouteLeverage` section mapping each invariant to its tests. `forge fmt --check` passes.
- **Testnet smoke first.** Because the `msg.value` leg and the real BOS cannot be tested locally, the first contract milestone is a testnet deploy and a `cast` smoke run of Unwind, Close and Leverage against a real Trove (extend `script/smoke-testnet.sh` or add a sibling), before any frontend work depends on it.

## App

### Where it lives

- Dashboard's Trove card gains **Leverage**, **Unwind** and **Close** actions, the redemption-queue line, and the surplus Claim (below). Users without a Trove see today's card.
- Pages, following the U11 flow pattern (`FlowColumn`, one action card, Confirm with the full risk list and the steps, receipt `/tx/?hash=` reused): `/trove/unwind/?cr=` → `/trove/unwind/confirm/`, `/trove/close/` → `/trove/close/confirm/`, `/trove/leverage/?cr=` → `/trove/leverage/confirm/`. URLs carry only intent; every page re-quotes from one multicall snapshot refetched every 15 s, quotes expire after 60 s, as in F3/F4.
- EOAs only: Bitcoin wallets see the pages with a Notice that Trove authorisations need an EVM wallet, and the actions are blocked through `writeBlocker`.

### Inputs

- **Unwind:** a target CR above the current one (presets plus a field). The quote solves `debtToRepay` and the BTC sold so the Trove lands at the target; the maximum is the largest repayment that keeps net debt ≥ 1,800 MUSD; beyond that the page offers Close.
- **Close:** no input. Shows the BTC the wallet receives (collateral − BTC sold).
- **Leverage:** a target CR below the current one, floor 200% (`LEVERAGE_CR_FLOOR`, next to the existing constants in `src/lib/trove/constants.ts`). The quote solves `btcToAdd` and `debtIncrease`. The maximum is the smallest of: the CR floor, the cap, the borrowing capacity (after a refinance if that helps), and the size at which the oracle bound would fail.
- **Cost against the oracle**, first on every Confirm page and under the receive row on every amount page: the swap's effective price against `PriceFeed`, as a percentage and in MUSD, with the pool fee and price impact under Details. The maximum each page offers is the largest size whose cost stays inside the oracle bound.
- **Open with leverage (stretch):** `/trove/open/?btc=&cr=` → confirm, for accounts with no Trove: BTC in, target CR (floor 200%), the minimum-debt rule explained, the surplus MUSD shown. Built only after the three main pages pass QA; if it is not built, the contract function still ships and the Dashboard's no-Trove card stays as today.
- Slippage as on the LP route (the shared `SlippagePopover`); the oracle bound defaults to 500 bps, and the page blocks with the measured gap when a quote's own deviation exceeds it.

### Quote maths (pure, tested)

`src/lib/trove/leverage/` (or similar): exact pool input for a given output mirroring the contract (tested against live `Pool.getAmountOut` round trips), the CR solver for each action, the borrowing fee, the liquidation price after, the oracle deviation of the quote, the redemption queue figure, and the capacity check. Mirrors the contract's rounding so the signed amounts are never short.

### Signatures and steps

- Unwind and Close: sign the `AdjustTrove` / `CloseTrove` authorisation (EIP-712, BOS domain, the F4 domain test pattern with a recovered live signature), sign the BTC permit (domain `("BTC", "1", chainId, 0x7b7C…)`, as in G1), send. Leverage: `AdjustTrove` + MUSD permit, send.
- Before sending: the BOS nonce has not moved (`BORROW_USED` pattern from F4), permits are still fresh (`permitState`), not in Recovery Mode, simulate the call.
- Hints for adjust: found at send time with the F4 helpers, falling back to zero hints.
- **Refinance step (Leverage):** when `debt + debtIncrease + fee > maxBorrowingCapacity` but a refinance at the current price would make room, the steps start with **Refinance** (a direct `BorrowerOperations.refinance` from the wallet, simulated first), and the Confirm page says what it does (fee ≈ 0.02% of debt, the Trove moves to the current interest rate). When even a refinance would not make room, the maximum is capped there with the reason.
- Gas: each new write path gets a measured budget constant per the Gas limits rule (`AGENTS.md`), from the testnet smoke transactions. Mainnet cannot be measured (it needs a mainnet Trove and its signature, and there is no mainnet round trip), so mainnet budgets are the testnet measurement plus 30% (G1's largest mainnet-over-testnet gap was the first gauge stake, which these paths do not touch), and `gasLimit` still takes `max(budget, estimate × 1.2)`. Expect several hundred thousand to over 1M gas (nested pool → hook → BOS → Trove); never rely on the wallet's estimate alone.

### Redemption risk

- **Queue figure:** "X MUSD of debt would be redeemed before yours" and the rank (n of N), before and after the action. Redemptions follow `SortedTroves` order, not ICR: `TroveManager.redeemCollateral` starts at `getLast()`, skips Troves with ICR < 110%, and walks `getPrev`. The list is ordered by NICR = coll / **principal** (interest left out), so Troves on different interest rates can sit in a different order than their ICR. The figure is the entire debt (`getEntireDebtAndColl`) of every Trove after the user's in list order with ICR ≥ 110%; the after-figure re-inserts the user's Trove by its new NICR. Mainnet has 4 Troves, testnet 367. A failed queue read blanks only the queue line.
- **Copy (verified against `TroveManager.redeemCollateral` by the builder before shipping):** redemptions start with the lowest-CR Troves above 110%; a redemption repays part of your debt with your BTC at the oracle price, so it undoes leverage rather than taking value at that price; if it closes your Trove, the remaining BTC waits for you to claim it. Leverage lowers CR, so the Confirm page's risk list puts the after-figure first.
- **Claim surplus:** when `CollSurplusPool.getCollateral(account) > 0`, the Dashboard shows a Claim card that calls `BorrowerOperations.claimCollateral()` directly (any wallet type; simulated first; a measured gas budget).

### Recovery Mode

Computed locally as in F4 (`systemColl × price / systemDebt < CCR`). When it holds, Unwind, Close and Leverage are blocked with the reason ("Mezo is in Recovery Mode: the protocol does not allow withdrawing collateral or closing a Trove until the system ratio is back above 150%"), and the Trove card offers **Repay from wallet** (a direct `BorrowerOperations.repayMUSD`, which the protocol allows in Recovery Mode) when the wallet holds MUSD, plus a link to the Mezo app. The pre-send check also blocks a Close that would itself push TCR under 150%.

### Errors

New `Error(string)` reverts from BorrowerOperations (Recovery Mode, capacity, min net debt, ICR) and the new contract's custom errors go into `decodeError` / `revert-strings.ts` with fixed messages and recovery actions; `npm run sync-abi` after the contract exists.

### Exposure

The existing `ExposurePanel` / "If BTC moves" chart takes the after-state of the Trove, so Leverage shows the higher BTC exposure and the new liquidation price, and Unwind/Close the lower one.

## Rollout

1. Contract with unit + invariant tests; testnet deploy; testnet smoke of all three paths against a real Trove (agent, testnet key in `contracts/.env`).
2. App pages and the Dashboard pieces; agent QA with Playwright and the mock wallet on the testnet QA accounts (`docs/STATUS.md`), including the "can borrow" and "at risk" accounts.
3. User's testnet round trips with MetaMask (Unwind, Close on a throwaway Trove, Leverage) through the app.
4. Mainnet deploy with the caps above (user's keystore, as M1/G1), explorer verification, `networks.ts` updated with `leverage: { address, deployBlock }` on both networks; sends are open on mainnet. No mainnet round trip by the team; a Notice on the three pages and a README line say the path has not yet run end to end on mainnet.
5. Docs: `PRODUCT_SPEC.md` §11.9 updated to this design (Close added, oracle bound, exits free, refinance as a step), §16 W2 rows ticked, §20 addresses; `contracts/SELF_AUDIT.md`; `AGENTS.md` (an L1 paragraph); README (Leverage/Unwind/Close, the mainnet note).

## Calls made by the agent (for the user to check)

- **Exits free, Leverage 10 bps** (Coil's model; never charge someone for getting safer; the fee is the same as every other MezoRoute route).
- **Close added** to §11.9's Leverage + Unwind: it is the one way to leave a Trove with no MUSD in the wallet, and it is what Pylon's and Coil's users use most.
- **Refinance as a separate step**, not a second signature inside the transaction: simpler contract, same outcome, one extra wallet confirmation only when needed.
- **Oracle bound one-sided, hard cap 10%, app default 5%:** testnet's pool sits 3.7% above the oracle today, so a 3% cap (Coil's) would block every testnet Leverage. The signed amounts stay the exact slippage guard.
- **Leverage floor 200% in the app**, 150% in the contract (`PRODUCT_SPEC.md` §4 already set 200% for leverage).
- **Mainnet sends open, with the caps** (user's decision, 7 Nov, after the agent proposed previews only). Unwind, Close and Leverage are usable on mainnet by users and judges. What keeps this safe without a mainnet round trip: every action is one atomic transaction, so any mismatch reverts and costs only gas; every send is simulated (`eth_call`) before the wallet is asked, so a broken path shows an error before any gas is spent; unit tests run both token orders (mainnet's `token0` is BTC, testnet's is MUSD); the caps bound the size; the contract holds nothing and has no admin. The app and README say "Not yet run end to end on mainnet" until the first real mainnet transaction, and the first outside mainnet transaction is checked by the agent against the event and the Trove (gas budget updated from it).
- **Pull the signed maximum, refund the rest** (instead of pulling the exact amount and leaving an allowance), so every permit ends at zero allowance.
- **Unified mock BTC in local tests**, so the balance invariant runs locally on the `msg.value` path.
- **Mainnet gas budgets = testnet + 30%**, since mainnet cannot be measured without a round trip.
- **`openLeveraged` in the contract now, its page as a stretch** (user agreed, 7 Nov): the contract is immutable, and without it almost no one can use Leverage.
- **Cost against the oracle as the headline figure** (user agreed, 7 Nov).
- **Mainnet caps 0.0125 BTC / 2,500 MUSD**, matching V2's BTC cap; with 0.48 BTC in the pool, the oracle bound will refuse sizes much larger anyway.

## Left to the builder

- Unit tests must run every path under **both token orders** of the pool (MUSD as `token0`, as on testnet, and BTC as `token0`, as on mainnet).
- Struct layouts, event field order, error names, the `data` encoding for the hook, and how the in-flight flag is stored.
- The exact pool-input formula and its rounding (tested to the wei; one wei less must revert).
- How the CR solvers are written (closed form or bisection), as long as they mirror the contract's rounding.
- Page copy within the rules above, preset values, and how the Trove card lays out the three actions (DESIGN.md governs).
- Whether the queue scan pages by owners array or by `SortedTroves.getPrev`, given the 367-Trove testnet book.
- Smoke script structure and which testnet Trove it uses.
