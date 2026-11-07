# MezoRouteExecutor — self-audit checklist

This is a self-review by the author, **not an external audit**. It is required before the capped
mainnet deployment (`PRODUCT_SPEC.md` 6, 11.8, 15). Re-run it on every change to `src/`.

- **Scope:** `src/MezoRouteExecutor.sol`, `src/MezoRouteExecutorV2.sol`, `src/MezoRouteLeverage.sol` (L1), `src/interfaces/`
- **Toolchain:** Solidity 0.8.24, `evm_version = london`, `via_ir`, optimizer 200 runs, OpenZeppelin 4.9.0
- **Dependencies:** Tigris Router/Pool/PoolFactory at `0a3b5e8`; MUSD `BorrowerOperationsSignatures`
- **Evidence:** `forge test` (unit, fuzz, invariant tests against the real Tigris source) and
  `script/smoke-testnet.sh` (live Mezo testnet)

Legend: ✅ holds, with evidence · ⚠️ accepted risk, see notes.

## 1. Security invariants (spec 11.8)

| # | Invariant | Where enforced | Evidence |
|---|---|---|---|
| 1 | Only the fixed MUSD, BTC, Router, pool, and BorrowerOperationsSignatures (V2: and the immutable gauge) are called | All targets are `immutable`; the only `.call`-like paths are typed calls on them | Code review: no `call`, `delegatecall`, `selfdestruct`, or user-supplied target ✅ |
| 2 | No arbitrary call target, token, or route | `_route()` builds the single MUSD↔BTC volatile hop with the immutable factory; params carry no address except `recipient` and the Trove hints (passed only to BOS) | Code review ✅ |
| 3 | All state-changing entry points are `nonReentrant` | `enter`, `borrowAndEnter`, `exit` | `test_enter_rejectsReentrantCall`, `test_borrowAndEnter_rejectsReentrantCall`, `test_exit_rejectsReentrantCall` ✅ |
| 4 | All token transfers use `SafeERC20` | `using SafeERC20 for IERC20`; approvals use `forceApprove` | Code review ✅ |
| 5 | Every allowance is exact and reset to zero | `forceApprove(router, exact)` before each Router call, `forceApprove(router, 0)` after | `test_enter_leavesNoRouterAllowance`, `test_exit_leavesNoRouterAllowance`, `invariant_noLingeringAllowances` ✅ |
| 6 | Minimums and deadlines enforced on-chain | `Expired()` check, Router `ensure(deadline)`, explicit min checks after every step | `test_*_revertsWhen*BelowMinimum` (swap, MUSD/BTC added, LP, MUSD/BTC removed, swap out, final out), `test_*_revertsWhenExpired`, `test_enter_acceptsDeadlineEqualToNow` ✅ |
| 7 | Pre-existing executor balances never paid out or credited | Every amount is a delta from `_snapshot()`; `_delta` and `_assertNoDecrease` revert on any decrease | `test_enter_neverPaysOutPreExisting{Balances,Lp}`, `test_exit_neverPaysOutPreExisting{Balances,Lp}`, `testFuzz_roundTrip_neverProfitsAndKeepsResidues`, `invariant_executorHoldsOnlyDonations` ✅ |
| 8 | No transaction-attributable MUSD, BTC, or LP left after a call | Residues refunded to `recipient`; LP minted straight to `recipient`; exit sends `musdOut` and BTC dust | Happy-path balance asserts, `invariant_executorHoldsOnlyDonations` ✅ |
| 9 | Borrowed MUSD only reaches the borrower; `borrowAndEnter` only by the borrower | `borrower = recipient = msg.sender` in the BOS call; `p.recipient == msg.sender` | `test_borrowAndEnter_borrowsToCallerThenDeposits`, `…revertsWhenRecipientIsNotCaller`, `…frontRunLeavesMusdWithUser`, `…revertsOnReplayedSignature` ✅ |
| 10 | No proxy, owner, pause, or admin withdrawal | No such code; all configuration is `immutable` | Code review ✅ |
| 11 | Fee only on entry, `musdIn × feeBps / 10_000`, ≤ `MAX_FEE_BPS`, only to `feeRecipient` | `_enter`; constructor `FeeTooHigh()` | `test_enter_mintsLpToRecipientAndChargesFee`, `test_fee_roundsDownOnDustAmounts`, `test_enter_withZeroFeeExecutorChargesNothing`, `test_borrowAndEnter_chargesExecutionFee`, `test_exit_chargesNoFee`, `test_constructor_{acceptsMaxFee,revertsAboveMaxFee}`, `test_roundTrip_executionFeeIsTheOnlyExtraCost` ✅ |
| 12 | Immutable per-transaction cap on entry | `_validateEnter`: `AmountAboveCap()`, checked before any borrow; `exit` has no cap | `CapTest` (5 tests), `DeployScriptTest` (1,000 MUSD mainnet, 1,000,000 MUSD testnet) ✅ |

### V2 additions (`src/MezoRouteExecutorV2.sol`, G1)

V2 keeps invariants 1-12 above (re-run as the `test/v2/` suite) and adds `enterFromBtc`, optional staking, and a BTC cap (`maxBtcIn`).

| # | Invariant | Where enforced | Evidence |
|---|---|---|---|
| 13 | No LP held after any call | `_addLiquidity` mints to the executor only when staking, requires the measured LP delta to equal the Router's `liquidityOut` (`LiquidityNotReceived`), then `_stake` deposits all of it, then the executor's LP must be back to its starting balance (`StakeIncomplete`); `_assertNoDecrease` | `test_enter_stake_creditsRecipientAndLeavesNothing`, `test_enterFromBtc_stake_creditsGauge`, `test_enter_stake_refundsGoToRecipientAndExecutorEndsEmpty`, `invariant_executorHoldsOnlyDonations`, `test_enter_stake_revertsWhenReceivedLpDiffersFromReported` (`LiquidityNotReceived`, reached with a mocked Router reply), `test_enter_stake_revertsWhenGaugePullsLessThanItCredits` (`StakeIncomplete`) ✅ |
| 14 | Gauge allowance is 0 after any call | `forceApprove(gauge, amount)` then `forceApprove(gauge, 0)` in `_stake` | `invariant_noLingeringAllowances`, `test_enter_stake_creditsRecipientAndLeavesNothing` ✅ |
| 15 | Staked LP credited only to `recipient`, exactly the deposited amount; gauge is never a recipient | `_stake` compares `gauge.balanceOf(recipient)` before/after (`StakeNotCredited`); `_requireValidRecipient` rejects the gauge | `test_enter_stake_recipientCredited_notCaller`, `test_enter_stake_revertsWhenGaugeCreditsLessThanDeposited`, `test_enter_revertsWhenRecipientIsGauge`, `test_exit_revertsWhenRecipientIsGauge`, `test_enterFromBtc_revertsOnBadRecipientAndInputs`, `invariant_stakeCreditedOnlyToActors` ✅ |
| 16 | BTC (and MUSD, LP) held before a call is never paid out, for `enterFromBtc` too | Same `_snapshot`/`_delta`/`_assertNoDecrease` | `test_enterFromBtc_ignoresPreExistingBalances` and `test_enter_neverPaysOutPreExistingBalances` (event values too), `test_enterFromBtc_swapMinimumNotSatisfiedByDonatedMusd`, `test_enter_swapMinimumNotSatisfiedByDonatedBtc`, `test_enter_stake_ignoresPreExistingExecutorLp`, `invariant_executorHoldsOnlyDonations` ✅ |
| 17 | The executor never touches MEZO | No MEZO reference in `src/`; rewards accrue in the gauge to the owner | `test_executorNeverTouchesMezo`, `invariant_mezoUnchanged` ✅ |

`InsufficientSwapOutput` is backed up by `test_enterFromBtc_revertsWhenSwapDeliversLessThanMinimum` (mocked Router reply); the real Router's own check is pinned in `test_enterFromBtc_slippageChecks`. The other checks the real Router makes unreachable are backed up the same way: `test_enter_swapMinimumNotSatisfiedByDonatedBtc`, `test_enter_revertsWhenRouterReportsLessThanMinimumsAdded`, `test_exit_revertsWhenRemoveDeliversLessThanMinimum`, `test_exit_revertsWhenSwapDeliversLessThanMinimum`.

Also covered for `enterFromBtc`: fee in BTC only (`test_enterFromBtc_feeInBtc`), cap at/above
`maxBtcIn` (`test_enterFromBtc_revertsAboveCap`), swap amount bounds, slippage, refunds to the
recipient with a non-zero BTC refund (`test_enterFromBtc_refundsBtcToRecipientNotCaller`,
`test_enterFromBtc_stake_refundsBtcToRecipientNotCaller`; `enter`: `test_enter_refundsBtcToRecipientNotCaller`,
`test_enter_stake_refundsBtcToRecipientNotCaller`), permit and front-run permit, reentrancy (`test_enterFromBtc_reentrancy`), killed or absent
gauge, and the constructor checks (`test_constructor_revertsOnZeroBtcCap`, `test_constructor_storesBtcCap`,
`test_constructor_revertsOnGaugeForOtherToken`).

Accepted: `exit` cannot unstake (`gauge.withdraw` pays only its caller), so leaving a staked position
takes two transactions.

### MezoRouteLeverage (`src/MezoRouteLeverage.sol`, L1)

A separate immutable contract for Unwind, Close, Leverage and Open-with-leverage on the caller's own Trove through a flash swap on the MUSD/BTC pool (`PRODUCT_SPEC.md` §11.9, spec `docs/superpowers/specs/2026-11-07-l1-unwind-leverage-design.md`). Tests run every suite under both pool token orders (MUSD `token0` as on testnet, BTC `token0` as on mainnet) with the real Tigris Pool and a revert-safe unified-ledger BTC mock (`test/mocks/MockUnifiedBtc.sol`); the real `msg.value` leg and BOS are proven by the testnet smoke run.

| # | Invariant | Where enforced | Evidence |
|---|---|---|---|
| L1 | Only the fixed MUSD, BTC, pool, factory, BOS, TroveManager and PriceFeed are called; no user-supplied target | All `immutable`; constructor checks `factory.getPool(musd, btc, false) == pool` | `test_constructor_poolMismatch`, `test_constructor_zeroAddressReverts`, code review ✅ |
| L2 | No owner, pause, setter, proxy or admin withdrawal | No such code | Code review ✅ |
| L3 | Every Trove action names the caller as borrower and recipient | `borrower = msg.sender`, passed as both arguments to every BOS call | `test_unwind_repaysAndReturnsRemainder`, `test_leverage_addsCollateralAndDebt`, `test_close_returnsAllCollateralLessBtcSold`, `invariant_recipientIsCallerAndNoAllowanceLeft` ✅ |
| L4 | The hook runs only for the pool, for a swap this contract started, for the operation in flight; it authenticates before decoding | `msg.sender == pool`, `sender == this`, `_op != 0` then `op == _op` | `test_hook_directCallReverts`, `test_hook_poolCallForAnotherSenderReverts`, `test_hook_poolCallPretendingToBeTheContractReverts`, `invariant_opIdle` ✅ |
| L5 | MUSD and BTC balances end every call where they started (Open: start − `msg.value`); nothing held before a call is paid out | `_balances` / `_verifyBalances` (`UnexpectedBalanceChange`) | `test_unwind_preExistingBalancesUntouched`, every happy-path test asserts zero balances, `invariant_holdsOnlyDonations` ✅ |
| L6 | No allowance left: the contract never approves; a permit for the signed maximum ends at zero | `_pullPayRefund` pulls the maximum, pays the exact input (and fee), refunds the rest | `test_unwind_repaysAndReturnsRemainder`, `test_close_returnsAllCollateralLessBtcSold`, `test_leverage_addsCollateralAndDebt`, `test_open_opensTroveWithUserAndFlashedBtc` (allowance 0), `invariant_recipientIsCallerAndNoAllowanceLeft` ✅ |
| L7 | The pool is paid exactly the smallest input its K check accepts | `exactInput` (volatile x·y, fee on input), reserves read in the hook | `testFuzz_exactInput_isTheSmallestThePoolAccepts` (one wei less reverts `K()`) ✅ |
| L8 | Swap price bounded by PriceFeed, one-sided, user bound ≤ 10% | `_checkSellBound`, `_payForBtc`; `DeviationTooHigh` above `MAX_DEVIATION_BPS` | `test_unwind_oracleBound`, `test_close_oracleBound`, `test_leverage_oracleBound`, `test_unwind_deviationAboveCap` ✅ |
| L9 | The user's signed amounts bound what they pay | `maxBtcToPool` / `maxMusdToPool` (`PoolInputAboveMax`); a pull never exceeds what was borrowed | `test_unwind_maxBtcToPoolTooLow`, `test_close_maxBtcToPoolTooLow`, `test_leverage_maxMusdToPoolTooLow`, `test_leverage_debtIncreaseTooSmall` ✅ |
| L10 | Leverage and Open leave ICR ≥ the user's minimum, which is ≥ 150% | `_checkCollateralRatio` after the swap; `MinCrBelowFloor` | `test_leverage_minCrEnforced`, `test_leverage_minCrBelowFloor` ✅ |
| L11 | Immutable per-transaction caps: BTC flashed (Leverage, Open), MUSD flashed (Unwind, Close) | `AmountAboveCap` before any external call | `test_unwind_capAbove`, `test_close_capAbove`, `test_leverage_capAbove`, `test_open_capAbove` ✅ |
| L12 | Fee only on Leverage and Open, `musdToPool × feeBps / 10_000`, ≤ 50 bps, only to `feeRecipient`; Unwind and Close are free | `_fee`, constructor `FeeTooHigh` | `test_leverage_addsCollateralAndDebt`, `test_open_opensTroveWithUserAndFlashedBtc`, `test_constructor_feeTooHigh`, Unwind/Close tests (no fee transfer) ✅ |
| L13 | Every entry point is `nonReentrant` | modifier on `unwind`, `close`, `leverage`, `openLeveraged` | `test_unwind_rejectsReentrantCall`, `test_leverage_rejectsReentrantCall` (each re-enters all four) ✅ |
| L14 | The signature binds the BTC sent: the contract sends exactly the signed `assetAmount` | `{value: btcToAdd}` / `{value: msg.value + btcToFlash}` | `test_leverage_signatureBindsMsgValue` ✅ |
| L15 | A used permit falls back to the allowance; without one the call reverts cleanly | try/catch permit | `test_unwind_permitAlreadyUsedFallsBackToAllowance`, `test_unwind_noPermitNoAllowanceReverts` ✅ |
| L16 | The contract never owns a Trove | It is never passed as borrower | `invariant_ownsNoTrove` ✅ |

Front-running a user's signature: whoever submits it must repay the debt (Unwind, Close) or supply the bound BTC (Leverage, Open) themselves, and every result goes to the borrower; the user's own call then reverts on the used nonce and nothing is lost. Recovery Mode, capacity, minimum net debt and MCR are the protocol's checks; the app checks them first and the contract bubbles the protocol's revert (`test_unwind_recoveryModeReverts`, `test_close_recoveryModeReverts`, `test_open_minNetDebt`).

## 2. Checklist

### Access control and configuration
- ✅ No privileged role exists; nothing can be changed after deployment.
- ✅ Constructor rejects zero addresses, zero cap, fee above 50 bps, a pool that is not
  `router.poolFor(MUSD, BTC, volatile, factory)` (`PoolMismatch`), and a factory that is not
  `router.defaultFactory()` (`FactoryMismatch`) — `addLiquidity`/`removeLiquidity` always use the
  default factory, so a different factory would swap on one pool and add liquidity to another.
- ⚠️ The constructor cannot prove that `musd`, `btc`, and `borrowerOperationsSignatures` are the
  real Mezo contracts. Mitigation: addresses are pinned in `script/Deploy.s.sol` and must be checked
  on the explorer after deployment (section 4).

### Reentrancy and external calls
- ✅ `nonReentrant` on every entry point (OZ 4.9 `ReentrancyGuard`).
- ✅ The Router passes empty `data` to `Pool.swap`, so the pool's `IPoolCallee.hook` flash-swap
  callback is never invoked on the executor.
- ✅ MUSD is a plain `ERC20Permit` (spec 4) and Tigris LP transfers only update fee indexes
  (`Pool._updateFor`); neither calls back into the executor. Reentrancy through a hooked token is
  still covered by the tests above, which use a MUSD mock that re-enters on `transfer`/`transferFrom`.

### Token accounting
- ✅ Delta accounting is used for every payout and every emitted value.
- ✅ `musdToSwap` must be non-zero and below the post-fee amount (`InvalidSwapAmount`).
- ✅ Event fields match balance changes (`test_enter_emitsEventMatchingBalanceChanges`,
  `test_borrowAndEnter_emitsBorrowedAmount`).
- ✅ No overflow: `musdIn ≤ maxMusdIn`, Solidity 0.8 checked arithmetic.
- ⚠️ Tokens donated to the executor are locked forever (no withdrawal path, by design). LP donated
  to the executor also accrues pool fees that nobody can claim. Neither affects users.

### Signatures and permits
- ✅ Permits are wrapped in `try/catch`: a front-run or invalid permit cannot block a call that has
  enough allowance (`test_enter_succeedsWhenPermitWasFrontRun`,
  `test_enter_invalidPermitFallsBackToExistingAllowance`); without allowance the call reverts.
- ✅ Permits bind `spender = executor`; a permit value below `musdIn` reverts
  (`test_enter_revertsWhenPermitValueBelowAmount`).
- ✅ Borrow signature front-run: the borrowed MUSD lands in the user's wallet and the executor call
  reverts on the consumed nonce (spec 11.4).
- ⚠️ EOA signers only: BOS verifies with `ECDSA.recover`, so smart accounts (Passport Bitcoin
  wallets) cannot use `borrowAndEnter` or permits; they use exact approvals and `enter`.

### Slippage, MEV, and liveness
- ⚠️ Sandwich protection depends on the minimums the caller passes. The contract enforces them;
  the frontend must derive them from a fresh quote (default 1% slippage, 60 s quote lifetime,
  10 min deadline, 5% price-impact gate). A caller passing zero minimums is unprotected.
- ⚠️ The cap bounds the size of each transaction (and price impact on the thin mainnet pool), not
  the number of transactions. The executor holds no funds between transactions, so there is no
  TVL to cap.
- ✅ Exit is never capped and charges no fee: users can always leave
  (`test_exit_isNotCapped`, `test_exit_chargesNoFee`).
- ✅ Dust exits revert in `Pool.burn` instead of silently losing LP (`test_exit_dustLiquidityReverts`).

### Chain-specific
- ⚠️ Mezo's BTC ERC-20 is a chain precompile; tests use a mock ERC-20. Real BTC transfers are covered
  only by the live smoke test (section 4).
- ✅ Compiled for `london` (Mezo has no `PUSH0`).
- ✅ Gas on testnet (2 Oct 2026): `enter` 0.40M, `exit` 0.35M, `borrowAndEnter` 2.18M (Trove interest accrual).

### Test environment limits
- The real Tigris Router/Pool/PoolFactory run locally; MUSD/BTC are OZ `ERC20Permit` mocks and
  BorrowerOperationsSignatures is a mock that, like the real one, accepts any sender once and pays
  the signed recipient. Real EIP-712 borrow signatures are exercised only by the smoke test
  (`BORROW=1`).
- No static analyser (Slither/Aderyn) was run; neither is installed in this environment.

## 3. Mutation checks

Each mutation below was applied to `src/MezoRouteExecutor.sol` and the suite was run; the listed
test failed, then the source was restored.

| Mutation | Caught by |
|---|---|
| `exit` burns the executor's whole LP balance instead of `liquidityIn` | `test_exit_neverPaysOutPreExistingLp` |
| `exit` without `nonReentrant` | `test_exit_rejectsReentrantCall` |
| `exit` without the zero-recipient check | `test_exit_revertsOnZeroRecipient` |
| Cap compared with `>=` instead of `>` | `test_enter_acceptsAmountEqualToCap`, `test_exit_isNotCapped` |
| `borrowAndEnter` borrows before validating its parameters | `test_borrowAndEnter_revertsWhenExpiredBeforeBorrowing` (and every `borrowAndEnter` happy path) |

### V2 (`src/MezoRouteExecutorV2.sol`, G1)

Each mutation was applied to a temporary copy of the contracts and the `test/v2/` suites were run
(5 Nov 2026). The first pass ran 109 tests; survivors that were real gaps got tests and were rerun
against 113. A comment-only control passed both times. `src/` in this repo was never changed.

| Mutation | Caught by |
|---|---|
| BTC refund on entry sent to the caller, not the recipient | `test_enter_refundsBtcToRecipientNotCaller`, `test_enter_stake_refundsBtcToRecipientNotCaller`, `test_enterFromBtc_refundsBtcToRecipientNotCaller`, `test_enterFromBtc_stake_refundsBtcToRecipientNotCaller` |
| MUSD refund on entry sent to the caller | `test_enter_refundsResidueToRecipientNotCaller`, `test_enter_stake_refundsGoToRecipientAndExecutorEndsEmpty`, `test_enterFromBtc_refundsToRecipient` |
| `enterFromBtc`: `musdFromSwap = musd.balanceOf(this)`, counting donated MUSD | `test_enterFromBtc_ignoresPreExistingBalances`, `test_enterFromBtc_swapMinimumNotSatisfiedByDonatedMusd` |
| `enter`: `btcFromSwap = btc.balanceOf(this)`, counting donated BTC | `test_enter_neverPaysOutPreExistingBalances`, `test_enter_swapMinimumNotSatisfiedByDonatedBtc`, `testFuzz_roundTrip_neverProfitsAndKeepsResidues` |
| `exit`: `musdFromSwap` counts donated MUSD | `test_exit_neverPaysOutPreExistingBalances` |
| `StakeNotCredited` check removed | `test_enter_stake_revertsWhenGaugeCreditsLessThanDeposited` |
| `StakeIncomplete` check removed | `test_enter_stake_revertsWhenGaugePullsLessThanItCredits` |
| `LiquidityNotReceived` check removed | `test_enter_stake_revertsWhenReceivedLpDiffersFromReported` |
| Gauge credits the wrong account (`deposit` for the executor or `feeRecipient`; `_stake` called for either) | 13-14 tests each, including `test_enter_stake_creditsRecipientAndLeavesNothing`, `test_enterFromBtc_stake_creditsGauge`, `test_borrowAndEnter_stake_creditsCaller` |
| BTC Router allowance reset removed after `addLiquidity` | `test_enter_refundsBtcToRecipientNotCaller`, `test_enter_stake_refundsBtcToRecipientNotCaller`, `test_enterFromBtc_refundsBtcToRecipientNotCaller`, `test_enterFromBtc_stake_refundsBtcToRecipientNotCaller` |
| BTC Router allowance reset removed after the `exit` swap | `test_exit_unswappedBtcGoesToRecipientAndAllowanceIsReset` |
| `exit`: BTC refund sent to the caller | `test_exit_unswappedBtcGoesToRecipientAndAllowanceIsReset` |
| `enterFromBtc` swap minimum check removed | `test_enterFromBtc_revertsWhenSwapDeliversLessThanMinimum`, `test_enterFromBtc_swapMinimumNotSatisfiedByDonatedMusd` |
| `enter` swap minimum check removed | `test_enter_swapMinimumNotSatisfiedByDonatedBtc` |
| Add-liquidity minimums removed: all, `minLpOut` | `test_enter_revertsWhenLpBelowMinimum`, `test_enterFromBtc_slippageChecks` |
| Add-liquidity minimums removed: `minMusdAdded`, `minBtcAdded` | `test_enter_revertsWhenRouterReportsLessThanMinimumsAdded` |
| `exit` removed-amount minimums removed: all, `minMusdRemoved`, `minBtcRemoved` | `test_exit_revertsWhenRemoveDeliversLessThanMinimum` |
| `exit` swap minimum check removed | `test_exit_revertsWhenSwapDeliversLessThanMinimum` |
| `exit` final minimum check removed | `test_exit_revertsWhenFinalOutputBelowMinimum` |
| `GaugeUnavailable` check removed | `test_enter_stake_revertsWithoutGauge`, `test_borrowAndEnter_stake_revertsWithoutGauge`, `test_enterFromBtc_stake_revertsWithoutGaugeOrOnKilledGauge` |
| BTC permit applied to MUSD | `test_enterFromBtc_permit_andFrontRunPermit` |
| Constructor gauge mismatch check removed | `test_constructor_revertsOnGaugeForOtherToken` |

The minimum checks caught only by a mocked Router reply are backups: the real Router enforces the
same minimums first, so these mutants matter only if the Router misbehaves.

Killed in the G1 final review and not rerun here: `nonReentrant` removed from `enterFromBtc`, BTC
desired includes the pre-existing balance, Router allowance reset removed after add, stake credits the
caller, BTC cap uses the MUSD cap, BTC fee sent to the caller.

Survivors, all equivalent:

| Mutation | Why no test can catch it |
|---|---|
| BTC Router allowance reset removed after the `enterFromBtc` swap | `_addLiquidity` always runs next, overwrites this allowance, and resets it to 0, and any other path reverts. Also passes `test/invariant/ExecutorV2`. |
| Gauge allowance reset removed (G1 final review, not rerun) | `StakeIncomplete` requires the gauge to have pulled all of the LP, so an exact allowance is already spent. |
| `_assertNoDecrease` removed on entry (G1 final review, not rerun) | The refund deltas already revert on a decrease in MUSD or BTC. For LP, `StakeIncomplete` covers the stake path and the other path never spends LP. |

## 4. Deployment checklist (run for every new deployment)

1. `forge fmt --check && forge test` pass on the commit being deployed.
2. Deploy with `script/Deploy.s.sol`; the cap comes from `maxMusdInFor(chainId)`.
3. Verify the source on the explorer.
4. Read back every immutable with `cast call` and compare with spec 11.1: `musd`, `btc`, `router`,
   `factory`, `pool`, `borrowerOperationsSignatures`, `feeBps`, `feeRecipient`, `maxMusdIn`.
5. Testnet: `script/smoke-testnet.sh` must end with `PASS: executor balances unchanged`.
   Mainnet: one small enter → exit round trip from the UI, then confirm executor balances are zero.
6. Update the frontend allowlist (executor address and fee), `contracts/README.md`, and spec 11.1.
7. V2 only: also read back `gauge` and `maxBtcIn` too; `gauge.stakingToken()` must
   equal `pool`; the BTC cap is pinned per chain in the deploy script (mainnet 0.0125 BTC, testnet 12 BTC);
   then run one small `enterFromBtc` with `stake = true` and confirm the executor holds no LP,
   MUSD, or BTC afterwards.

### Deployment record

| Deployment | Steps 1-7 | Evidence |
|---|---|---|
| V2 mainnet `0xb3461B35577cD2aC5ccb6d71e7f89a16bE257915` (block 13,031,359, 6 Nov 2026) | ✅ all | Source verified (Blockscout). All 11 immutables read back and match spec 11.1, including `gauge` `0x8Be2…9AaF` (`stakingToken() == pool`, `voter.gauges(pool)`, alive) and `maxBtcIn` 0.0125 BTC. Real round trip through the UI with MetaMask: enter 10 MUSD with stake, `getReward`, unstake, exit, then `enterFromBtc` 0.00003 BTC with `stake = true`. Afterwards the executor holds 0 BTC, MUSD, LP, MEZO, has no gauge stake, and every allowance it sets is 0. Hashes in `PRODUCT_SPEC.md` §20. |
| V2 testnet `0x1281cC769c136F9F4f291B390c8992a3Cd556288` (block 16,569,977, 4 Nov 2026) | ✅ all | `script/smoke-testnet.sh` PASS; see `PRODUCT_SPEC.md` §20. |
