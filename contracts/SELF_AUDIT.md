# MezoRouteExecutor — self-audit checklist

This is a self-review by the author, **not an external audit**. It is required before the capped
mainnet deployment (`PRODUCT_SPEC.md` 6, 11.8, 15). Re-run it on every change to `src/`.

- **Scope:** `src/MezoRouteExecutor.sol`, `src/interfaces/` (≈ 260 lines of logic)
- **Toolchain:** Solidity 0.8.24, `evm_version = london`, `via_ir`, optimizer 200 runs, OpenZeppelin 4.9.0
- **Dependencies:** Tigris Router/Pool/PoolFactory at `0a3b5e8`; MUSD `BorrowerOperationsSignatures`
- **Evidence:** `forge test` (unit, fuzz, invariant tests against the real Tigris source) and
  `script/smoke-testnet.sh` (live Mezo testnet)

Legend: ✅ holds, with evidence · ⚠️ accepted risk, see notes.

## 1. Security invariants (spec 11.8)

| # | Invariant | Where enforced | Evidence |
|---|---|---|---|
| 1 | Only the fixed MUSD, BTC, Router, pool, and BorrowerOperationsSignatures are called | All targets are `immutable`; the only `.call`-like paths are typed calls on them | Code review: no `call`, `delegatecall`, `selfdestruct`, or user-supplied target ✅ |
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
- ✅ Gas: `enter` ≈ 0.39M, `borrowAndEnter` ≈ 2.12M (Trove interest accrual) on testnet.

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

## 4. Deployment checklist (run for every new deployment)

1. `forge fmt --check && forge test` pass on the commit being deployed.
2. Deploy with `script/Deploy.s.sol`; the cap comes from `maxMusdInFor(chainId)`.
3. Verify the source on the explorer.
4. Read back every immutable with `cast call` and compare with spec 11.1: `musd`, `btc`, `router`,
   `factory`, `pool`, `borrowerOperationsSignatures`, `feeBps`, `feeRecipient`, `maxMusdIn`.
5. Testnet: `script/smoke-testnet.sh` must end with `PASS: executor balances unchanged`.
   Mainnet: one small enter → exit round trip from the UI, then confirm executor balances are zero.
6. Update the frontend allowlist (executor address and fee), `contracts/README.md`, and spec 11.1.
