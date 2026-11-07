# L1: Unwind, Close and Leverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-transaction Unwind, Close, Leverage and Open-with-leverage on a user's own MUSD Trove through a new immutable `MezoRouteLeverage` contract, with honest previews (cost against the oracle, redemption queue, Recovery Mode, capacity) in the app.

**Architecture:** `MezoRouteLeverage` flash-swaps the MUSD/BTC Tigris pool, acts on the Trove through `BorrowerOperationsSignatures` with `borrower = recipient = msg.sender`, pays the pool from the user's wallet (pull the signed maximum, pay exact, refund), and keeps nothing. The app adds `/trove/*` flow pages built from the U11 flow components; pure quote maths in `src/lib/leverage/` mirrors the contract's rounding.

**Tech Stack:** Solidity 0.8.24 / Foundry (London, via-IR, OZ 4.9.0, Tigris `0a3b5e8`); Next.js 14 static export, wagmi 2.19.5, viem 2.57.2, Vitest, Playwright for agent QA.

**Spec:** `docs/superpowers/specs/2026-11-07-l1-unwind-leverage-design.md` (approved 7 Nov 2026). Read it before any task; this plan does not restate its reasoning.

## Global Constraints

- Contracts: Solidity 0.8.24, `evm_version = london` (no transient storage, no `PUSH0`-dependent features), `via_ir = true`, OpenZeppelin 4.9.0 import paths (`security/ReentrancyGuard.sol`), no fork tests, `forge fmt --check` passes before every commit.
- `MezoRouteLeverage`: immutable, no owner/admin/pause/setter/proxy; `feeBps ≤ 50`, applied to Leverage and Open only; Unwind and Close charge no MezoRoute fee.
- `MAX_DEVIATION_BPS = 1_000`; `MIN_CR_FLOOR = 1.5e18`; app oracle-bound default `500` bps; app leverage CR floor `LEVERAGE_CR_FLOOR = 2.0e18`.
- Caps: testnet `maxBtcFlash = 12e18`, `maxMusdFlash = 1_000_000e18`; mainnet `maxBtcFlash = 125e14` (0.0125 BTC), `maxMusdFlash = 2_500e18`.
- Every BOS call: `borrower = recipient = msg.sender`. The contract never calls `approve`. MUSD and BTC balances of the contract end every call equal to their start (Open: start − `msg.value`).
- Protocol constants: MCR 110%, CCR 150%, minimum net debt 1,800 MUSD, gas compensation 200 MUSD, borrowing rate read from chain (0.1% today).
- EIP-712 domain for all Trove authorisations: `borrowDomain(network)` (`name "BorrowerOperationsSignatures"`, version `"1"`). Type strings exactly:
  - `AdjustTrove(uint256 collWithdrawal,uint256 debtChange,bool isDebtIncrease,uint256 assetAmount,address borrower,address recipient,uint256 nonce,uint256 deadline)`
  - `CloseTrove(address borrower,address recipient,uint256 nonce,uint256 deadline)`
  - `OpenTrove(uint256 assetAmount,uint256 debtAmount,address borrower,address recipient,uint256 nonce,uint256 deadline)`
- BTC permit domain `("BTC", "1", chainId, 0x7b7C000000000000000000000000000000000000)`; MUSD permit domain "Mezo USD", version "1" (existing helpers in `lib/routes/musd-btc-lp/permit.ts`).
- Frontend: EOAs only for the three flash actions and Open (Bitcoin wallets see a Notice); Claim surplus and Repay from wallet work for every wallet type. Mainnet sends are open; the three pages and README carry "Not yet run end to end on mainnet" until the first real mainnet transaction.
- Every page re-quotes from one multicall snapshot, refetched every 15 s; quotes expire after 60 s (`QUOTE_TTL_MS`). URLs carry only intent.
- `DESIGN.md` governs every component; the existing guards (`typography`, `radius-guard`, `spacing-guard`, `control-guard`, `palette-guard`, `motion-guard`, `icon-guard`, `heading-guard`, …) must pass. Errors go through `decodeError`; the toast never shows raw error text.
- Gas: every new write path gets a budget constant in `src/lib/quote/gas.ts` = max(highest `gasUsed`, highest healthy `eth_estimateGas`) + 5%, rounded up to 5,000, from the testnet smoke transactions; mainnet uses the same constants × 1.3 (`MAINNET_LEVERAGE_GAS_FACTOR`), sent through `gasLimit(budget, estimate)`.
- Copy: never promise profit; never call a redemption a loss or safe without the mechanism; always show the testnet pool/oracle gap through the cost-against-oracle figure.
- Run before claiming done: `cd contracts && forge test && forge fmt --check`; `cd frontend && npm test && npm run build`.

## Review Focus

1. **Debt grows between quote and send (Close).** Interest accrues every second; a user who signs and waits 2 minutes must still close. Expected: `maxBtcToPool` carries a margin for 300 s of interest plus slippage; the contract pays the exact amount. Test in Task 7 (`quoteClose covers 300 s of interest`) and Task 3 (`test_close_paysExactAfterInterestAccrues`).
2. **The BOS nonce moved after signing** (the user acted in the Mezo app, or an earlier signature was submitted). Expected: the flow stops with `TROVE_AUTH_USED` and asks to sign again; it never sends a doomed transaction. Test in Task 11 (`troveAuthState returns used when the nonce moved`).
3. **Unwind that would leave net debt under 1,800 MUSD.** Expected: the Unwind maximum stops at `debt − 2,000` MUSD and the page offers Close beyond it. Test in Task 7 (`unwindMax keeps net debt at 1,800`).
4. **Leverage blocked by borrowing capacity even after a refinance.** Expected: the maximum is capped at the refinance capacity with the reason; when a refinance helps, the plan starts with a Refinance step; in Recovery Mode neither is offered. Test in Task 8 (`leverageMax caps at refinance capacity`, `leverageSteps adds refinance only when it makes room`).
5. **Pool moved between quote and send** (another trade, or a sandwich attempt). Expected: the pre-send simulation fails with `PRICE_MOVED` ("The pool price moved; review the new quote"), never a raw revert; a move past the oracle bound fails on chain with `OracleBoundExceeded` decoded the same way. Test in Task 11 (`decodeError maps OracleBoundExceeded and PoolInputAboveMax to PRICE_MOVED`).

---

## File map

**Contracts (`contracts/`)**
- `src/MezoRouteLeverage.sol` — the contract.
- `src/interfaces/IMezoRouteLeverage.sol` — structs, events, errors, entry points.
- `src/interfaces/external/IBorrowerOperationsSignatures.sol` — add `adjustTroveWithSignature`, `closeTroveWithSignature`, `openTroveWithSignature`.
- `src/interfaces/external/ITroveManagerMinimal.sol`, `IPriceFeedMinimal.sol`, `IPoolMinimal.sol` (swap, getReserves, token0, token1), `IPoolFactoryMinimal.sol` (getPool, getFee).
- `test/mocks/MockUnifiedBtc.sol`, `test/mocks/MockMusdProtocol.sol`, `test/mocks/MockPriceFeed.sol`; `test/mocks/MockERC20Permit.sol` gains `burn`.
- `test/harness/LeverageHarness.sol`; `test/leverage/*.t.sol`; `test/invariant/Leverage.invariant.t.sol` + `LeverageHandler.sol`.
- `script/DeployLeverage.s.sol`, `script/smoke-leverage-testnet.sh`.
- `SELF_AUDIT.md` (new section).

**Frontend (`frontend/src/`)**
- `lib/config/networks.ts` — `leverage` block, `addresses.collSurplusPool`.
- `lib/abi/mezoRouteLeverage.ts` (generated), `lib/abi/musd.ts` (new fragments).
- `lib/leverage/` — `pool-math.ts`, `oracle-cost.ts`, `trove-math.ts`, `quote-unwind.ts`, `quote-close.ts`, `quote-leverage.ts`, `quote-open.ts`, `capacity.ts`, `queue.ts`, `signatures.ts`, `snapshot.ts`, `gate.ts`, `steps.ts`, `params.ts`, `intent.ts`, `receipt.ts`, `useTroveFlow.ts`, `useTroveSnapshot.ts`, `risks.ts`, `copy.ts`.
- `components/trove/` — `TroveActionPage.tsx`, `TroveConfirmPage.tsx`, `CostLine.tsx`, `QueueLine.tsx`, `TroveChange.tsx`, `SurplusClaimCard.tsx`, `RepayFromWallet.tsx`, `MainnetTroveNotice.tsx`.
- `app/trove/{unwind,close,leverage,open}/page.tsx` and `…/confirm/page.tsx`.
- `components/dashboard/TroveCard.tsx`, `Dashboard.tsx`; `lib/tx/receipt-kind.ts`; `components/receipt/*`; `lib/errors/{revert-strings,custom-errors,outcomes}.ts`; `lib/quote/gas.ts`.

---

### Task 1: Test harness and protocol mocks

**Files:**
- Create: `contracts/test/mocks/MockUnifiedBtc.sol`, `contracts/test/mocks/MockMusdProtocol.sol`, `contracts/test/mocks/MockPriceFeed.sol`, `contracts/test/harness/LeverageHarness.sol`
- Modify: `contracts/test/mocks/MockERC20Permit.sol` (add `burn(address from, uint256 amount)`)
- Test: `contracts/test/leverage/Harness.t.sol`

**Interfaces:**
- Produces:
  - `MockUnifiedBtc` — ERC-20 + EIP-2612 (name "BTC", version "1") whose `balanceOf(a) == a.balance`; `transfer`/`transferFrom` move native balance with `vm.deal` (import `Vm` from forge-std, `Vm(address(uint160(uint256(keccak256("hevm cheat code")))))`); `mint(to, amount)` = `vm.deal(to, to.balance + amount)`; `totalSupply` returns 0 (unused).
  - `MockMusdProtocol` — plays both BOS and TroveManager for one test chain. State per borrower: `coll`, `principal`, `interest`, `active`, `nonce`. Functions with the real signatures: `adjustTroveWithSignature(...) payable`, `closeTroveWithSignature(borrower, recipient, signature, deadline)`, `openTroveWithSignature(...) payable`, `updateSystemAndTroveInterest(address)`, `getTroveDebt(address) returns (uint256)` (principal + interest), `getTroveColl(address)`, `getCurrentICR(address, uint256 price)`, `getNonce(address)`. It checks `signature == abi.encode(keccak256(<the fields the real typehash binds, msg.value as assetAmount>), nonce)` (tests build it with `sig(...)` helpers in the harness), deadline, `recipient != address(this)`; repay/close burn MUSD from `msg.sender` (revert `"BorrowerOps: Caller doesnt have enough mUSD to make repayment"` when short); close burns `debt − 200e18`; increases mint `debtChange` to `recipient` and add `debtChange + debtChange/1000` (0.1% fee) to principal; withdrawals send native BTC to `recipient`; enforces net debt ≥ 1,800e18 after a repayment and ICR ≥ 1.1e18 at `price`; `setRecoveryMode(bool)` makes withdrawals/close revert `"BorrowerOps: Collateral withdrawal not permitted Recovery Mode"`; `accrue(address, uint256 interest)` adds interest for interest-drift tests.
  - `MockPriceFeed` — `fetchPrice() view returns (uint256)`, `setPrice(uint256)`.
  - `LeverageHarness` (abstract, `Test`) — deploys the real Tigris `Pool`/`PoolFactory`/`Router` with `MockERC20Permit` MUSD and `MockUnifiedBtc`, seeds 1,000,000 MUSD / 10 BTC (price 100,000), deploys `MockMusdProtocol` and `MockPriceFeed(100_000e18)`; `bool internal btcIsToken0` chosen by a virtual `_btcFirst()` so every suite runs twice (`contract UnwindTestMusdFirst is UnwindTest { _btcFirst() → false }` and `…BtcFirst`), produced by deploying tokens in the order that makes `token0` the wanted one (Tigris sorts by address: deploy, compare, redeploy if needed). Helpers: `_openTrove(user, coll, debt)`, `_sigAdjust(...)`, `_sigClose(...)`, `_sigOpen(...)`, `_permit(token, ownerKey, spender, value, deadline)`.

- [ ] **Step 1: Write the failing tests** in `test/leverage/Harness.t.sol` (both token orders):
  - `test_unifiedBtc_poolSwapMovesNativeBalance`: a Router swap of 1,000 MUSD for BTC raises `user.balance` by exactly the BTC out and `btc.balanceOf(pool)` equals `pool.balance`.
  - `test_mockProtocol_repayBurnsFromCaller`: an adjust with repayment from an address without MUSD reverts with the exact string above.
  - `test_mockProtocol_rejectsReusedSignature` and `test_mockProtocol_closeBurnsDebtMinusGasComp`.
  - `test_tokenOrder_matchesFlag`: `Pool(pool).token0() == (btcIsToken0 ? address(btc) : address(musd))`.
- [ ] **Step 2: Run** `cd contracts && forge test --match-path test/leverage/Harness.t.sol -vv` — Expected: compile errors / FAIL (files missing).
- [ ] **Step 3: Implement** the four files and `burn` (`burn` callable by anyone; test-only mock).
- [ ] **Step 4: Run** the same command — Expected: all PASS for both orders; then `forge test` (whole suite) still PASS.
- [ ] **Step 5: Commit** `test(contracts): leverage harness with unified BTC and MUSD protocol mocks`.

---

### Task 2: `MezoRouteLeverage` core and `unwind`

**Files:**
- Create: `contracts/src/MezoRouteLeverage.sol`, `contracts/src/interfaces/IMezoRouteLeverage.sol`, `contracts/src/interfaces/external/{ITroveManagerMinimal,IPriceFeedMinimal,IPoolMinimal,IPoolFactoryMinimal}.sol`
- Modify: `contracts/src/interfaces/external/IBorrowerOperationsSignatures.sol`
- Test: `contracts/test/leverage/{Constructor,PoolInput,Unwind,Hook}.t.sol`

**Interfaces:**
- Consumes: Task 1 harness.
- Produces (`IMezoRouteLeverage`):

```solidity
struct Permit { uint256 value; uint256 deadline; uint8 v; bytes32 r; bytes32 s; } // value 0 = use allowance
struct TroveAuth { address upperHint; address lowerHint; bytes signature; uint256 deadline; }
struct UnwindParams { uint256 debtToRepay; uint256 collWithdrawal; uint256 maxBtcToPool; uint256 maxDeviationBps; uint256 deadline; }
struct CloseParams { uint256 maxBtcToPool; uint256 maxDeviationBps; uint256 deadline; }
struct LeverageParams { uint256 btcToAdd; uint256 debtIncrease; uint256 maxMusdToPool; uint256 minCollateralRatio; uint256 maxDeviationBps; uint256 deadline; }
struct OpenLeveragedParams { uint256 btcToFlash; uint256 debtAmount; uint256 maxMusdToPool; uint256 minCollateralRatio; uint256 maxDeviationBps; uint256 deadline; }

event Unwound(address indexed borrower, uint256 debtRepaid, uint256 collWithdrawn, uint256 btcToPool);
event Closed(address indexed borrower, uint256 debtRepaid, uint256 collReturned, uint256 btcToPool);
event Leveraged(address indexed borrower, uint256 btcAdded, uint256 debtIncrease, uint256 musdToPool, uint256 fee, uint256 musdSurplus);
event OpenedLeveraged(address indexed borrower, uint256 btcFromUser, uint256 btcFlashed, uint256 debtAmount, uint256 musdToPool, uint256 fee, uint256 musdSurplus);

error ZeroAmount(); error ZeroAddress(); error AmountAboveCap(); error Expired(); error FeeTooHigh();
error PoolMismatch(); error DeviationTooHigh(); error MinCrBelowFloor(); error CollateralRatioTooLow();
error PoolInputAboveMax(); error OracleBoundExceeded(); error UnauthorizedHook(); error UnexpectedBalanceChange();

function unwind(UnwindParams calldata p, TroveAuth calldata a, Permit calldata btcPermit) external returns (uint256 btcToPool);
function close(CloseParams calldata p, TroveAuth calldata a, Permit calldata btcPermit) external returns (uint256 btcToPool);
function leverage(LeverageParams calldata p, TroveAuth calldata a, Permit calldata musdPermit) external returns (uint256 musdToPool);
function openLeveraged(OpenLeveragedParams calldata p, TroveAuth calldata a, Permit calldata musdPermit) external payable returns (uint256 musdToPool);
```

- Constructor `(address musd_, address btc_, address factory_, address pool_, address bos_, address troveManager_, address priceFeed_, uint256 feeBps_, address feeRecipient_, uint256 maxBtcFlash_, uint256 maxMusdFlash_)`; public immutables of the same names without the underscore, plus `bool public immutable btcIsToken0`. Reverts: `ZeroAddress`, `ZeroAmount` (either cap 0), `FeeTooHigh`, `PoolMismatch` when `IPoolFactory(factory).getPool(musd, btc, false) != pool`.
- `function exactInput(uint256 reserveIn, uint256 reserveOut, uint256 amountOut, uint256 feeBps) public pure returns (uint256)` — smallest `x` with `(reserveIn + x − x*feeBps/10_000) * (reserveOut − amountOut) ≥ reserveIn * reserveOut`: start from `ceil(need * 10_000 / (10_000 − feeBps))` where `need = ceil(reserveIn*reserveOut/(reserveOut−amountOut)) − reserveIn`, then step down while `x − 1` still satisfies and up while `x` does not.
- Hook: `function hook(address sender, uint256 amount0, uint256 amount1, bytes calldata data) external` — reverts `UnauthorizedHook` unless `msg.sender == pool && sender == address(this) && _op != 0` and the op id in `data` equals `_op` (`uint256 private _op`, set before `swap`, cleared after; 1 unwind, 2 close, 3 leverage, 4 open).

- [ ] **Step 1: Write the failing tests:**
  - `Constructor.t.sol`: each zero address → `ZeroAddress`; `feeBps 51` → `FeeTooHigh`; wrong pool → `PoolMismatch`; `btcIsToken0` matches the pool.
  - `PoolInput.t.sol` (fuzz, both orders): for random `amountOut` up to 50% of the reserve, a raw `Pool.swap` with `exactInput(...)` paid inside a test hook succeeds and with `exactInput(...) − 1` reverts `K()`; fee read from `factory.getFee(pool, false)`.
  - `Unwind.t.sol`: `test_unwind_repaysAndReturnsRemainder` (Trove 1 BTC / 40,000 MUSD; repay 10,000; `collWithdrawal` = quote × 1.01; afterwards debt −10,000, coll −`collWithdrawal`, user BTC + (`collWithdrawal − btcToPool`), MUSD unchanged, contract MUSD/BTC 0, BTC allowance user→contract 0, event fields exact); `test_unwind_noMusdInWallet` (user holds 0 MUSD); `test_unwind_capAbove` → `AmountAboveCap`; `test_unwind_expired`; `test_unwind_deviationAboveCap` (1,001) → `DeviationTooHigh`; `test_unwind_oracleBound` (set oracle 3% above pool, bound 200 → `OracleBoundExceeded`; bound 500 passes); `test_unwind_maxBtcToPoolTooLow` → `PoolInputAboveMax`; `test_unwind_recoveryModeReverts`; `test_unwind_permitAlreadyUsedFallsBackToAllowance`; `test_unwind_preExistingBalancesUntouched` (contract pre-funded with MUSD and BTC by a donor: unchanged after).
  - `Hook.t.sol`: direct `hook` call → `UnauthorizedHook`; pool calling with `sender != this` (a second contract swapping with this as `to`) → `UnauthorizedHook`.
- [ ] **Step 2: Run** `forge test --match-path "test/leverage/*" -vv` — Expected: FAIL (contract missing).
- [ ] **Step 3: Implement** the interfaces, the constructor, `exactInput`, the oracle check (one-sided: Unwind/Close require `btcToPool * price ≤ musdOut * 1e18 * (10_000 + dev) / 10_000`), the payment helper `_pullPayRefund(IERC20 token, uint256 max, uint256 exact, address to, Permit calldata permit)` (try/catch permit like V2 `_tryPermit`, pull `max` from `msg.sender`, transfer `exact` to `to`, refund `max − exact`), the balance snapshot/verify (`UnexpectedBalanceChange`), `nonReentrant`, and `unwind` as spec § `unwind`. Reserves are read once before `swap` and mapped by `btcIsToken0`.
- [ ] **Step 4: Run** the same command — Expected: PASS (both orders); `forge fmt --check` clean.
- [ ] **Step 5: Commit** `feat(contracts): MezoRouteLeverage core and unwind`.

---

### Task 3: `close`

**Files:** Modify `contracts/src/MezoRouteLeverage.sol`; Test `contracts/test/leverage/Close.t.sol`.

**Interfaces:** Consumes Task 2. Produces `close` as declared.

- [ ] **Step 1: Write the failing tests** (both orders): `test_close_returnsAllCollateralLessBtcSold` (Trove 1 BTC / 40,000; afterwards Trove inactive, user BTC + (1 BTC − btcToPool), contract balances 0, allowance 0, `Closed.debtRepaid == 40,000e18 − 200e18`, `collReturned == 1e18`); `test_close_paysExactAfterInterestAccrues` (quote, `accrue` 5 MUSD, close with the quote's margin still passes and `btcToPool` matches `exactInput` for the new debt); `test_close_capAbove` (debt − 200 > `maxMusdFlash` → `AmountAboveCap`); `test_close_recoveryModeReverts`; `test_close_oracleBound`; `test_close_noTroveReverts`.
- [ ] **Step 2: Run** `forge test --match-path test/leverage/Close.t.sol -vv` — Expected: FAIL.
- [ ] **Step 3: Implement** `close` per spec: `updateSystemAndTroveInterest(msg.sender)`, `debt = getTroveDebt`, `coll = getTroveColl`, `musdNeeded = debt − 200e18` (constant `GAS_COMPENSATION = 200e18`), flash, `closeTroveWithSignature(msg.sender, msg.sender, a.signature, a.deadline)`, pay. (`_updateTroveInterest` also applies pending redistribution, so `getTroveDebt`/`getTroveColl` are exact after it.)
- [ ] **Step 4: Run** — Expected: PASS; whole `forge test` PASS.
- [ ] **Step 5: Commit** `feat(contracts): close a Trove from its own collateral`.

---

### Task 4: `leverage` and `openLeveraged`

**Files:** Modify `contracts/src/MezoRouteLeverage.sol`; Test `contracts/test/leverage/{Leverage,OpenLeveraged}.t.sol`.

**Interfaces:** Consumes Task 2. Produces `leverage`, `openLeveraged` as declared.

- [ ] **Step 1: Write the failing tests** (both orders):
  - Leverage: `test_leverage_addsCollateralAndDebt` (Trove 1 BTC / 30,000; add 0.2 BTC; `maxMusdToPool` = quote × 1.01; `debtIncrease = maxMusdToPool + fee`; afterwards coll +0.2, debt + `debtIncrease` × 1.001, user MUSD + `musdSurplus` exactly, `feeRecipient` + `fee` where `fee = musdToPool * 10 / 10_000`, contract balances 0, MUSD allowance 0); `test_leverage_minCrEnforced` (`minCollateralRatio` above the result → `CollateralRatioTooLow`); `test_leverage_minCrBelowFloor` (1.49e18 → `MinCrBelowFloor`); `test_leverage_capAbove`; `test_leverage_oracleBound` (oracle 3% below pool: bound 200 fails, 500 passes); `test_leverage_debtIncreaseTooSmall` (`maxMusdToPool + fee > debtIncrease` → `PoolInputAboveMax`); `test_leverage_signatureBindsMsgValue` (signature for 0.2 BTC, params 0.19 → mock rejects).
  - Open: `test_open_opensTroveWithUserAndFlashedBtc` (user sends 0.5 BTC, flashes 0.3, debt 25,000; Trove coll 0.8, user MUSD surplus exact, contract native/BTC balance back to start, event exact); `test_open_existingTroveReverts`; `test_open_zeroMsgValue` → `ZeroAmount`; `test_open_minNetDebt` (debt 1,000 → mock's min-debt revert).
- [ ] **Step 2: Run** `forge test --match-path "test/leverage/*Leverage*" -vv` — Expected: FAIL.
- [ ] **Step 3: Implement** per spec §§ `leverage`, `openLeveraged`. Oracle check for buying BTC: `musdToPool * 1e18 ≤ btcOut * price * (10_000 + dev) / 10_000`. Post-condition `getCurrentICR(msg.sender, price) ≥ p.minCollateralRatio`. In Open the start snapshot is read after `msg.value` is credited and the expected end is `start − msg.value` for BTC.
- [ ] **Step 4: Run** — Expected: PASS; whole suite PASS.
- [ ] **Step 5: Commit** `feat(contracts): leverage and open with leverage in one transaction`.

---

### Task 5: Invariants, reentrancy, self-audit, spec update

**Files:**
- Create: `contracts/test/invariant/Leverage.invariant.t.sol`, `contracts/test/invariant/LeverageHandler.sol`, `contracts/test/leverage/Reentrancy.t.sol`
- Modify: `contracts/SELF_AUDIT.md`, `PRODUCT_SPEC.md` §11.9 and §16 (W2-1, W2-4 rows)

**Interfaces:** Consumes Tasks 2–4.

- [ ] **Step 1: Write the invariant suite.** Handler actions: `unwind`, `close`, `leverage`, `openLeveraged` for 3 actors with bounded random sizes, `movePool` (a random Router swap by a third party), `moveOracle` (±10%), `donate` (send MUSD/BTC to the contract). Invariants: `invariant_holdsOnlyDonations` (contract MUSD/BTC balance == sum of donations), `invariant_noAllowanceLeft` (user → contract allowances 0 after every call), `invariant_opIdle` (`_op == 0`, read with `vm.load`), `invariant_troveRecipientIsCaller` (every Trove action in the mock recorded `recipient == borrower == caller`). `Reentrancy.t.sol`: a `ReentrantMUSD`-style token that re-enters each entry point during `transferFrom` → reverts `ReentrancyGuard: reentrant call`.
- [ ] **Step 2: Run** `forge test --match-path "test/invariant/Leverage*" -vv` and `--match-path test/leverage/Reentrancy.t.sol` — Expected: PASS (fix the contract if not).
- [ ] **Step 3: Update `SELF_AUDIT.md`** with a `MezoRouteLeverage` section: one row per invariant (balance delta, allowance 0, recipient = caller, hook authentication, oracle bound, caps, no admin, exact pool input) → the test names above. **Update `PRODUCT_SPEC.md` §11.9** to the spec's design (Close and Open added, recipient rule unchanged, pull-max-and-refund, oracle bound, exits free, refinance as a separate step, unified-BTC testing) and tick W2-1/W2-4.
- [ ] **Step 4: Run** `forge test && forge fmt --check` — Expected: all PASS, fmt clean.
- [ ] **Step 5: Commit** `test(contracts): leverage invariants and self-audit`.

---

### Task 6: Testnet deploy and live smoke

**Files:**
- Create: `contracts/script/DeployLeverage.s.sol`, `contracts/script/smoke-leverage-testnet.sh`
- Test: `contracts/test/DeployLeverage.t.sol`
- Modify: `frontend/src/lib/config/networks.ts` (testnet `leverage` block only), `docs/STATUS.md`

**Interfaces:**
- Produces: `DeployLeverage.addressesFor(chainId)` (musd, btc, factory, pool, bos, troveManager, priceFeed — values from `networks.ts`), `maxBtcFlashFor`, `maxMusdFlashFor` (Global Constraints values); testnet `leverage = { address, deployBlock, feeBps: 10n, maxBtcFlash, maxMusdFlash }`; measured gas numbers and four real signed authorisations (one per type) recorded in `docs/STATUS.md` for Task 9's recovery tests.

- [ ] **Step 1: Write `DeployLeverage.t.sol`** asserting the per-chain caps and addresses (as `Deploy.t.sol` does) — run `forge test --match-path test/DeployLeverage.t.sol`, expect FAIL, implement the script, expect PASS.
- [ ] **Step 2: Deploy to testnet** with `forge create` / `cast send --create` (forge script simulation touches BTC and fails): `set -a && source .env && set +a`; constructor args from `addressesFor(31611)`, `FEE_BPS=10`, `FEE_RECIPIENT=0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8`. Read back every immutable with `cast call` and compare. Verify on the explorer (Blockscout `forge verify-contract --verifier blockscout`).
- [ ] **Step 3: Write `smoke-leverage-testnet.sh`** in the style of `smoke-testnet.sh` (`send()` polling, `require`, typed-data signing with `cast wallet sign --data`). Order on the deployer's testnet Trove: (1) `unwind` a small amount; (2) `leverage` a small amount; (3) `close`; (4) `openLeveraged` to reopen (so the key ends with a Trove). After each: contract MUSD/BTC balance unchanged, allowance 0, event fields equal the Trove deltas read with `getEntireDebtAndColl`, `getTroveDebt == getEntireDebtAndColl` principal+interest after `updateSystemAndTroveInterest` (pending redistribution check). Print `gasUsed` and the RPC estimate at block − 1 for each, and the four signatures with their messages. `GAS_MULT=1.3` when measuring.
- [ ] **Step 4: Run** `bash script/smoke-leverage-testnet.sh` — Expected: four mined transactions, every `require` passes. If the `msg.value` leg fails, stop and report: the design depends on it.
- [ ] **Step 5: Record** the address, deploy block, gas figures, and the four signatures in `docs/STATUS.md`; add the testnet `leverage` block to `networks.ts`. Commit `feat(contracts): deploy MezoRouteLeverage to testnet with a live smoke run`.

---

### Task 7: Pool and Trove maths; Unwind and Close quotes

**Files:**
- Create: `frontend/src/lib/leverage/{pool-math,oracle-cost,trove-math,quote-unwind,quote-close}.ts` + `.test.ts` each
- Modify: `frontend/src/lib/trove/constants.ts` (add `LEVERAGE_CR_FLOOR = 2_000_000_000_000_000_000n`, `ORACLE_BOUND_DEFAULT_BPS = 500n`, `MIN_NET_DEBT = 1_800n * 10n ** 18n`, `GAS_COMPENSATION = 200n * 10n ** 18n`, `CLOSE_INTEREST_MARGIN_SECONDS = 300n`)

**Interfaces:**
- Produces:
  - `exactInput(reserveIn: bigint, reserveOut: bigint, amountOut: bigint, feeBps: bigint): bigint` — the contract's algorithm, bit for bit.
  - `oracleCostBps(side: "buyBtc" | "sellBtc", musd: bigint, btc: bigint, price: bigint): bigint` — positive = worse than the oracle; `withinOracleBound(costBps, boundBps): boolean`.
  - `type TroveState = { coll: bigint; principal: bigint; interest: bigint; debt: bigint; maxBorrowingCapacity: bigint; interestRateBps: bigint }`; `type PoolState = { reserveMusd: bigint; reserveBtc: bigint; feeBps: bigint }`; `type Market = { price: bigint; borrowingRate: bigint; mcr: bigint }`.
  - `troveAfter(t: TroveState, change: { collDelta: bigint; debtDelta: bigint; feeOnIncrease: bigint }): TroveState` — repayment pays interest first, then principal (MUSD's rule); `cr(t, price)`, `nominalCr(t)` (coll × 1e20 / principal), `liquidationPriceOf(t, mcr)`.
  - `type UnwindQuote = { debtToRepay; collWithdrawal; btcToPool; btcToWallet; maxBtcToPool; costBps; before: TroveState; after: TroveState; crBefore; crAfter }` (all `bigint` except the states); `quoteUnwind(t, pool, market, targetCr: bigint, slippageBps: bigint): UnwindQuote | null` (bisection on `debtToRepay`, 64 iterations, rounds so `crAfter ≥ targetCr`); `unwindMax(t): bigint` = `t.debt − MIN_NET_DEBT − GAS_COMPENSATION` (0 if negative).
  - `type CloseQuote = { musdNeeded; btcToPool; maxBtcToPool; btcToWallet; costBps; collReturned }`; `quoteClose(t, pool, market, slippageBps): CloseQuote` — `maxBtcToPool` uses the debt after `CLOSE_INTEREST_MARGIN_SECONDS` of interest at `t.interestRateBps`, then × (1 + slippage).

- [ ] **Step 1: Write the failing tests:**
  - `pool-math.test.ts`: the contract's fuzz cases replayed as fixed vectors (copy 10 `(reserveIn, reserveOut, amountOut, fee, expected)` rows printed by a `forge test -vv` run of `PoolInput.t.sol` with `console2.log`); plus a live S1 testnet swap replay: given the reserves and output of one real `Swap` event, `exactInput` ≤ the event's `amountIn`.
  - `oracle-cost.test.ts`: testnet 7 Nov figures (pool 78,609 vs oracle 75,816: buying 1 BTC at mid costs ≈ 368 bps); one-sided sign.
  - `trove-math.test.ts`: `troveAfter` repays interest before principal; `nominalCr` uses principal only.
  - `quote-unwind.test.ts`: `quoteUnwind lands at or above the target CR`; `unwindMax keeps net debt at 1,800`; `quoteUnwind returns null when the target is at or below the current CR`.
  - `quote-close.test.ts`: `quoteClose covers 300 s of interest` (with 5% interest on 40,000 MUSD the margin covers ≥ 0.0634 MUSD); `btcToWallet = coll − btcToPool`.
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/lib/leverage` — Expected: FAIL.
- [ ] **Step 3: Implement** the five modules.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): pool, trove, unwind and close quote maths`.

---

### Task 8: Leverage and Open quotes, capacity and refinance

**Files:** Create `frontend/src/lib/leverage/{quote-leverage,quote-open,capacity}.ts` + tests.

**Interfaces:**
- Consumes: Task 7 types and `exactInput`, `oracleCostBps`, `troveAfter`.
- Produces:
  - `capacityAfterRefinance(t, price): bigint` = `t.coll × price / 1.1e18`; `type CapacityCheck = "ok" | "refinance" | "blocked"`; `capacityCheck(t, price, debtIncrease, borrowingRate): CapacityCheck`.
  - `type LeverageQuote = { btcToAdd; maxMusdToPool; musdToPool; fee; debtIncrease; borrowingFee; musdSurplus; costBps; before; after; crBefore; crAfter; capacity: CapacityCheck }`; `quoteLeverage(t, pool, market, targetCr, slippageBps, feeBps): LeverageQuote | null` (bisection on `btcToAdd`; `debtIncrease = maxMusdToPool + fee`; `crAfter ≥ targetCr`).
  - `leverageMax(t, pool, market, feeBps, caps: { maxBtcFlash: bigint }, boundBps: bigint): { btc: bigint; limitedBy: "floor" | "cap" | "capacity" | "oracle" }` — the smallest of `LEVERAGE_CR_FLOOR`, the cap, refinance capacity, and the oracle bound.
  - `type OpenQuote = { btcFromUser; btcToFlash; debtAmount; maxMusdToPool; musdToPool; fee; musdSurplus; costBps; after; crAfter }`; `quoteOpen(btcFromUser, pool, market, targetCr, slippageBps, feeBps): OpenQuote | null` — `debtAmount = max(maxMusdToPool + fee, MIN_NET_DEBT − borrowingFee)` (net debt ≥ 1,800), null when `crAfter < targetCr` is unavoidable at the minimum debt.
  - `leverageSteps(capacity: CapacityCheck): ("refinance" | "authorise" | "permit" | "send")[]`.

- [ ] **Step 1: Write the failing tests:** `quoteLeverage lands at or above the target CR`; `musdSurplus = debtIncrease − musdToPool − fee`; `leverageMax caps at refinance capacity` (Trove where capacity binds before the floor → `limitedBy: "capacity"`); `leverageMax caps at the oracle bound on testnet` (testnet 7 Nov reserves and oracle, bound 500 → `limitedBy: "oracle"`); `leverageSteps adds refinance only when it makes room`; `quoteOpen keeps net debt at 1,800 on mainnet sizes` (mainnet 7 Nov reserves, 0.045 BTC from the user, cap 0.0125 → `debtAmount ≥ 1,800e18 − fee` and surplus > 0); `quoteOpen returns null when 200% is unreachable`.
- [ ] **Step 2: Run** `npx vitest run src/lib/leverage` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): leverage and open quotes with capacity checks`.

---

### Task 9: Config, ABI, signatures, redemption queue, snapshot

**Files:**
- Create: `frontend/src/lib/leverage/{signatures,queue,snapshot,useTroveSnapshot}.ts` + tests for the pure ones; `frontend/src/lib/abi/mezoRouteLeverage.ts` (generated)
- Modify: `frontend/scripts/sync-abi.mjs` (add `MezoRouteLeverage`), `frontend/src/lib/abi/musd.ts`, `frontend/src/lib/config/networks.ts` (`NetworkConfig.leverage`, `addresses.collSurplusPool`; mainnet `leverage: null` until Task 15)

**Interfaces:**
- Produces:
  - `NetworkConfig.leverage: { address: Address; deployBlock: bigint; feeBps: bigint; maxBtcFlash: bigint; maxMusdFlash: bigint } | null`; `addresses.collSurplusPool` (read from `BorrowerOperationsSignatures.collSurplusPoolAddress()` on both networks with `cast` and pin it).
  - `adjustTypedData({ network, borrower, collWithdrawal, debtChange, isDebtIncrease, assetAmount, nonce, deadline })`, `closeTypedData({ network, borrower, nonce, deadline })`, `openTypedData({ network, borrower, assetAmount, debtAmount, nonce, deadline })` — all with `recipient = borrower`, domain `borrowDomain`.
  - `type QueueEntry = { owner: Address; nicr: bigint; icr: bigint; debt: bigint }`; `redemptionQueue(entries: QueueEntry[], account: Address, accountNicrAfter: bigint | null, mcr: bigint): { debtAhead: bigint; rank: number; total: number }` — sort by NICR ascending (redemption end first), skip `icr < mcr`, ties count as ahead; `readQueue(read, network): Promise<QueueEntry[]>` (owners via `getTroveOwnersCount`/`getTroveFromTroveOwnersArray`, then `getNominalICR`, `getEntireDebtAndColl`, `getCurrentICR` in multicall pages of 100).
  - `type TroveSnapshot = { trove: TroveState | null; pool: PoolState; market: Market; system: SystemState; recoveryMode: boolean; bosNonce: bigint; musdPermitNonce: bigint; btcPermitNonce: bigint; walletMusd: bigint; walletBtc: bigint; surplusBtc: bigint; troveStatus: number; block: { number: bigint; timestamp: bigint } }`; `troveSnapshotContracts(network, account)` + `parseTroveSnapshot(results)`; `useTroveSnapshot()` refetching every 15 s, the queue loaded beside it (a failed queue read gives `queue: null`).
- [ ] **Step 1: Write the failing tests:** `signatures.test.ts` recovers each of the four live testnet signatures recorded in Task 6 to the deployer address (wrong field order or type fails); `queue.test.ts`: list-order not ICR order (two Troves whose ICR order and NICR order differ), skip below MCR, after-state re-insert, ties ahead; `snapshot.test.ts`: parse a recorded multicall result; Recovery Mode computed with `isRecoveryMode`.
- [ ] **Step 2: Run** `npx vitest run src/lib/leverage` — Expected: FAIL.
- [ ] **Step 3: Implement**; run `cd ../contracts && forge build && cd ../frontend && npm run sync-abi`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS (including `networks` tests and guards).
- [ ] **Step 5: Commit** `feat(frontend): leverage config, signatures, redemption queue and snapshot`.

---

### Task 10: Intent, gate, params, risks, errors, gas, receipt

**Files:**
- Create: `frontend/src/lib/leverage/{intent,gate,params,risks,copy,receipt}.ts` + tests
- Modify: `frontend/src/lib/errors/{revert-strings,custom-errors,outcomes}.ts`, `frontend/src/lib/quote/gas.ts`, `frontend/src/lib/tx/receipt-kind.ts`

**Interfaces:**
- Produces:
  - `type TroveAction = "unwind" | "close" | "leverage" | "open"`; `parseIntent(action, search: URLSearchParams): { cr: bigint | null; btc: bigint | null; slippageBps: bigint }`; `intentQuery(...)`.
  - `type TroveBlockReason = "no-trove" | "has-trove" | "smart-account" | "recovery-mode" | "below-min-debt" | "above-cap" | "oracle-bound" | "capacity" | "not-deployed" | "wrong-network" | "insufficient-btc" | "stale-quote"`; `troveActionBlock(action, snapshot, quote, walletKind, network, walletChainId): { reason: TroveBlockReason; outcome: Outcome | null } | null`.
  - `buildUnwindCall`, `buildCloseCall`, `buildLeverageCall`, `buildOpenCall` → `{ address, abi, functionName, args, value? }`; `refinanceCall(network, hints)`, `claimCollateralCall(network)`, `repayCall(network, amount, hints)`.
  - `troveRisks(action): string[]` (the full Confirm list; first line of Leverage/Open is the redemption-queue after-figure sentence); `copy.ts`: `MAINNET_NOT_RUN = "Not yet run end to end on mainnet."`, `RECOVERY_MODE_BLOCK = "Mezo is in Recovery Mode: the protocol does not allow withdrawing collateral or closing a Trove until the system ratio is back above 150%."`, `EVM_ONLY = "Trove authorisations need an EVM wallet such as MetaMask. Bitcoin wallets can claim surplus BTC and repay from the wallet."`, the redemption copy verified against `TroveManager.redeemCollateral`.
  - Outcomes `TROVE_AUTH_USED`, `PRICE_MOVED`, `RECOVERY_MODE`, `CAPACITY_SHORT`; custom errors `OracleBoundExceeded`/`PoolInputAboveMax` → `PRICE_MOVED`, `CollateralRatioTooLow` → `PRICE_MOVED`, `AmountAboveCap` → fixed message; revert strings: Recovery Mode, capacity (`"BorrowerOps: An operation that exceeds maxBorrowingCapacity is not permitted"`), min net debt, ICR/MCR, `"BorrowerOps: Caller doesnt have enough mUSD to make repayment"`.
  - Gas constants `UNWIND_GAS`, `CLOSE_GAS`, `LEVERAGE_GAS`, `OPEN_LEVERAGED_GAS`, `REFINANCE_GAS`, `CLAIM_COLLATERAL_GAS`, `REPAY_GAS` from Task 6's measurements by the Global Constraints rule (`REFINANCE_GAS`, `CLAIM_COLLATERAL_GAS`, `REPAY_GAS` from `cast estimate` on testnet against the QA "can borrow" account); `MAINNET_LEVERAGE_GAS_FACTOR = 13n` (÷10) and `troveGasBudget(action, network)`.
  - `findTroveReceipt(logs, network)` for the four events; `ReceiptKind` gains `{ kind: "trove"; event: TroveReceipt }`.
- [ ] **Step 1: Write the failing tests:** gate: one test per block reason, including `smart-account` for every flash action but not for claim/repay, and `recovery-mode` blocking all three; params: calldata of each builder decodes back to the quote's numbers and `borrower = recipient = account`; errors: `decodeError maps OracleBoundExceeded and PoolInputAboveMax to PRICE_MOVED`, every new revert string maps; receipt: decode one real Task 6 receipt per event; gas: `troveGasBudget("close", mainnet) = CLOSE_GAS × 13 / 10`.
- [ ] **Step 2: Run** `npx vitest run src/lib/leverage src/lib/errors src/lib/tx src/lib/quote` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): trove action gate, calls, errors, gas and receipts`.

---

### Task 11: The flow hook

**Files:** Create `frontend/src/lib/leverage/{steps,useTroveFlow}.ts` + `steps.test.ts`, `auth-state.test.ts`.

**Interfaces:**
- Consumes: Tasks 9–10; `submitCall`/`confirmCall`, `stepperReducer`, `permitTypedData`/`permitState`/`toExecutorPermit`, `findHints`, `BlockedError`.
- Produces:
  - `type TroveStepKind = "refinance" | "authorise" | "permit" | "send"`; `troveSteps(action, capacity): TroveStepKind[]` (Unwind/Close: authorise, permit, send; Leverage: [refinance], authorise, permit, send; Open: authorise, permit, send).
  - `troveAuthState(auth: { nonce: bigint; deadline: bigint }, nowSeconds: bigint, chainNonce: bigint): "usable" | "expired" | "used"` (reuse `borrowAuthorisationState`'s rule).
  - `useTroveFlow({ action, account, intent, plan, refresh }): { stepper; run }` — pins account and chain on the first step; refinance (simulate, send direct, confirm, then re-plan); authorise (EIP-712 with a fresh nonce and `deadline = block.timestamp + DEADLINE_SECONDS`); permit (value = `maxBtcToPool` or `maxMusdToPool + fee`); send: refresh, re-quote, check auth and permit states (`TROVE_AUTH_USED`, sign again on expired), Recovery Mode check, find hints (fall back to zero), simulate, `submitCall(config, call, pin, troveGasBudget(...))`, route to `/tx/?hash=`.
- [ ] **Step 1: Write the failing tests:** `troveAuthState returns used when the nonce moved`; `troveSteps` for each action and capacity; a reducer-level test that a send after a moved nonce dispatches `TROVE_AUTH_USED` (extract the pre-send checks into a pure `preSendCheck(snapshot, auth, permit, now): Outcome | null` in `steps.ts` and test it).
- [ ] **Step 2: Run** `npx vitest run src/lib/leverage` — Expected: FAIL.
- [ ] **Step 3: Implement** (`useEntryFlow.ts` is the pattern to follow).
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): trove action flow hook`.

---

### Task 12: Unwind and Close pages, Dashboard Trove card

**Files:**
- Create: `frontend/src/components/trove/{TroveActionPage,TroveConfirmPage,CostLine,QueueLine,TroveChange,SurplusClaimCard,RepayFromWallet,MainnetTroveNotice}.tsx`, `frontend/src/app/trove/{unwind,close}/page.tsx`, `…/confirm/page.tsx`
- Modify: `frontend/src/components/dashboard/{TroveCard,Dashboard}.tsx`, `frontend/src/components/receipt/*` (trove receipt), `frontend/src/lib/glossary.ts` (add `redemption`, `refinance` terms if absent)
- Test: `frontend/src/components/trove/trove-pages.test.ts` (render-level, the pattern of `components/flow/flow.test.ts`)

**Interfaces:** Consumes Tasks 7, 9–11. Pages are `dynamic(..., { ssr: false })` like `app/route/lp/confirm/page.tsx`.

- [ ] **Step 1: Write the failing tests:** amount page shows the cost line, the queue line (before → after), CR and liquidation price before → after, Max = `unwindMax`, "Close instead" beyond it; Close confirm lists the BTC to the wallet first; Confirm pages lead with the cost against the oracle; Recovery Mode renders `RECOVERY_MODE_BLOCK` plus Repay from wallet (when MUSD > 0) and no action button; a Bitcoin wallet sees `EVM_ONLY`; mainnet shows `MAINNET_NOT_RUN`; the Trove card shows Unwind/Close/Leverage links, the queue line, and `SurplusClaimCard` when `surplusBtc > 0`; a failed queue read hides only the queue line.
- [ ] **Step 2: Run** `npx vitest run src/components/trove src/components/dashboard` — Expected: FAIL.
- [ ] **Step 3: Implement** with the flow building blocks (`FlowColumn`, `ActionCard`, `ReceiveRow`, `Overview`, `Details`, `SlippagePopover`, `ConfirmCard`, `StepList`), the exposure panel fed the after-state, and `Term` on the first "redemption" mention.
- [ ] **Step 4: Run** `npm test && npm run build` — Expected: PASS, build clean.
- [ ] **Step 5: Commit** `feat(frontend): unwind and close pages and the Trove card actions`.

---

### Task 13: Leverage page

**Files:** Create `frontend/src/app/trove/leverage/page.tsx`, `…/confirm/page.tsx`; Modify `frontend/src/components/trove/*` as needed; Test `frontend/src/components/trove/leverage-page.test.ts`.

**Interfaces:** Consumes Tasks 8, 11, 12.

- [ ] **Step 1: Write the failing tests:** target CR input with floor 200% and presets; Max states its `limitedBy` reason; capacity "refinance" shows the Refinance step and its explanation (fee ≈ 0.02% of debt, current interest rate); capacity "blocked" caps the maximum with the reason; MUSD surplus shown; risk list leads with the queue after-figure; BTC exposure increases in the exposure panel.
- [ ] **Step 2: Run** `npx vitest run src/components/trove` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run build` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): leverage page with the refinance step`.

---

### Task 14: Agent QA, docs, user round trips

**Files:** Modify `AGENTS.md` (an L1 paragraph under Frontend and the contract bullet), `README.md`, `docs/STATUS.md`, `frontend/DESIGN.md` only if a new component pattern appeared.

- [ ] **Step 1: Serve and drive** `frontend/out` with Playwright and the keyless mock EIP-1193 wallet on the testnet QA accounts ("can borrow", "at risk", "no Trove") and the deployer: every page at 360 / 768 / 1440 px, both themes, no horizontal scroll, 0 console errors; each flow reaches its first wallet request with calldata equal to `params.ts` output; Recovery Mode and Bitcoin-wallet notices via a mocked snapshot. Expected: all pass; fix and re-run anything that does not.
- [ ] **Step 2: Docs:** AGENTS.md (L1 paragraph: contract, pages, quote modules, gas constants, mainnet note), README (Unwind/Close/Leverage, "Not yet run end to end on mainnet"), STATUS (state, the user checklist below, and a standing item: when the first outside mainnet transaction lands, the agent checks its event against the Trove, updates the mainnet gas budgets from it, and removes `MAINNET_NOT_RUN`).
- [ ] **Step 3: Hand the user the testnet checklist** (real MetaMask through the app): Unwind, Leverage, Close on a throwaway Trove; agent then reads each event against the Trove.
- [ ] **Step 4: Run** `cd contracts && forge test && forge fmt --check && cd ../frontend && npm test && npm run build` — Expected: all PASS.
- [ ] **Step 5: Commit** `docs: L1 unwind, close and leverage`.

---

### Task 15: Mainnet deploy and verification (user's keystore)

**Files:** Modify `frontend/src/lib/config/networks.ts` (mainnet `leverage` block), `PRODUCT_SPEC.md` §20, `docs/STATUS.md`.

- [ ] **Step 1: Agent prepares** the exact `forge create` command for chain 31612 with `--account mezo-mainnet`, constructor args from `DeployLeverage.addressesFor(31612)`, caps 0.0125 BTC / 2,500 MUSD, `FEE_BPS=10`, `FEE_RECIPIENT=0x375aaA9e9E70e36F42d5414eC10b46B847f6d6e8`; **the user runs it** (approval gate: irreversible).
- [ ] **Step 2: Agent reads back** every immutable with `cast call` against the inputs, verifies the source on the explorer, and checks the hook rejects a direct call (`cast call` → `UnauthorizedHook`).
- [ ] **Step 3: Add** the mainnet `leverage` block; `npm test && npm run build` PASS; mock-wallet check of the three mainnet pages (preview, `MAINNET_NOT_RUN`, simulate reaches the wallet request for the mainnet QA account where a Trove exists, otherwise the no-Trove state).
- [ ] **Step 4: Record** address, block, tx hash in `PRODUCT_SPEC.md` §20 and STATUS.
- [ ] **Step 5: Commit** `feat: MezoRouteLeverage on mainnet`.

---

### Task 16 (stretch, only after Task 14 passes): Open with leverage page

**Files:** Create `frontend/src/app/trove/open/page.tsx`, `…/confirm/page.tsx`; Modify `frontend/src/components/dashboard/TroveCard.tsx` (no-Trove card links "Open with leverage"); Test `frontend/src/components/trove/open-page.test.ts`.

- [ ] **Step 1: Write the failing tests:** BTC input (wallet BTC less the gas reserve, as `tokenAmountMax`), target CR ≥ 200%, the minimum-debt rule explained, MUSD surplus shown, `quoteOpen` null → the reason; only for accounts with no active Trove.
- [ ] **Step 2: Run** `npx vitest run src/components/trove` — Expected: FAIL.
- [ ] **Step 3: Implement** on the same `TroveActionPage`/`TroveConfirmPage`.
- [ ] **Step 4: Run** `npm test && npm run build` and a Playwright pass on the "no Trove" QA account — Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): open a Trove with leverage`.
